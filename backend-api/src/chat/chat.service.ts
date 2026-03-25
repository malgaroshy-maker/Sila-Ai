import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SupabaseService } from '../supabase.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly aiService: AiService,
  ) {}

  private async getSettings(userEmail: string) {
    const sb = this.supabaseService.getClient();
    const { data } = await sb.from('settings').select('*').eq('user_email', userEmail);
    const settings: any = {};
    data?.forEach(s => { settings[s.key] = s.value; });
    return {
      apiKey: settings.gemini_api_key || process.env.GEMINI_API_KEY || '',
      model: settings.gemini_model || 'gemini-1.5-flash'
    };
  }

  async chat(userEmail: string, message: string, history: { role: string; text: string }[]) {
    const sb = this.supabaseService.getClient();
    const settings = await this.getSettings(userEmail);
    const genAI = new GoogleGenerativeAI(settings.apiKey);
    const model = genAI.getGenerativeModel({ model: settings.model });

    // 1. RAG Step: Search for relevant candidate CV snippets using Vector DB
    let ragContext = '';
    let matchedCount = 0;
    try {
      const queryEmbedding = await this.aiService.generateEmbedding(userEmail, message);
      const { data: matched, error: matchError } = await sb.rpc('match_candidates', {
        query_embedding: queryEmbedding,
        match_threshold: 0.1, // Low threshold to get more context
        match_count: 5,       // Top 5 relevant CV snippets
        user_email_filter: userEmail // THE FIX: Filter by current user
      });

      if (matched && matched.length > 0) {
        matchedCount = matched.length;
        ragContext = matched.map((m: any) => 
          `[Candidate CV Snippet - ID: ${m.candidate_id}]\n${m.content}`
        ).join('\n---\n');
      }
    } catch (e) {
      this.logger.error(`RAG retrieval failed: ${e.message}`);
    }

    // 2. Metadata Step: Fetch basic jobs and analysis overview for the user
    const [jobsRes, analysisRes] = await Promise.all([
      sb.from('jobs').select('*').eq('user_email', userEmail),
      sb.from('analysis_results')
        .select('*, applications!inner(job_id, candidate_id, jobs!inner(title, user_email), candidates!inner(name, email))')
        .eq('applications.jobs.user_email', userEmail)
        .order('created_at', { ascending: false })
        .limit(20) // Limit to top 20 latest/best analyses for general context
    ]);

    const jobs = jobsRes.data || [];
    const analyses = analysisRes.data || [];

    // Build context summaries
    const jobsSummary = jobs.map(j => `- "${j.title}" (ID: ${j.id}): ${j.description}`).join('\n');
    const analysisSummary = analyses.map(a => {
      const name = a.applications?.candidates?.name || 'Unknown';
      const job = a.applications?.jobs?.title || 'Unknown Job';
      const isGrad = a.is_fresh_graduate ? '🎓 Fresh Grad' : 'Professional';
      return `- ${name} (${isGrad}) | Job: "${job}" | Score: ${a.final_score}/100 | Fit: ${a.cultural_fit_score}/100 | Trajectory: ${a.career_trajectory} | Tags: ${a.tags?.join(', ')}`;
    }).join('\n');

    const systemPrompt = `أنت مساعد ذكاء اصطناعي متخصص في التوظيف (RAG-Enabled).
أجب بالعربية أو الإنجليزية حسب لغة السؤال. كن مختصراً ومفيداً ودقيقاً.

=== سياق المستندات المسترجعة (RAG) ===
هذه نصوص من السير الذاتية الأكثر صلة بسؤال المستخدم:
${ragContext || 'لا توجد مستندات مطابقة تماماً'}

=== الوظائف الحالية ===
${jobsSummary || 'لا توجد وظائف'}

=== ملخص أفضل التحليلات (أعلى 20) ===
${analysisSummary || 'لا توجد نتائج تحليل'}

=== تعليمات ===
- استخدم "سياق المستندات المسترجعة" للإجابة عن تفاصيل دقيقة في السير الذاتية.
- استخدم "ملخص أفضل التحليلات" للمقارنة السريعة والترتيب حسب الدرجات.
- إذا لم تجد المعلومة في السياق، قل بوضوح أنك لا تملك هذه المعلومة.
- اعتمد على البيانات والأرقام المتوفرة بدلاً من التخمين.
- إذا سألك المستخدم "order candidates" أو "من الأفضل"، استخدم درجات التحليل (final_score).`;

    // Gemini Conversation History
    const chatHistory = history.map(h => ({
      role: h.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: h.text }]
    }));

    try {
      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: 'System context: ' + systemPrompt }] },
          { role: 'model', parts: [{ text: 'فهمت. أنا متصل الآن بقاعدة بيانات المتجهات وجاهز لتحليل السير الذاتية وتقديم إجابات دقيقة بناءً على المحتوى المسترجع. كيف يمكنني مساعدتك اليوم؟' }] },
          ...chatHistory,
        ],
      });

      const result = await chat.sendMessage(message);
      const responseText = result.response.text();

      // Log usage for the chat message (result.response.usageMetadata contains token counts)
      await this.aiService.logUsage(userEmail, 'chat', result.response.usageMetadata);

      this.logger.log(`Chat RAG: "${message.slice(0, 50)}..." → ${matchedCount} matches found`);
      return { response: responseText };
    } catch (error: any) {
      this.logger.error('Chat error:', error.message);
      return { response: 'عذراً، حدث خطأ في معالجة طلبك عبر نظام RAG. حاول مرة أخرى.' };
    }
  }
}
