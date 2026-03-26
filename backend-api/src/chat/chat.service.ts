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
      model: settings.gemini_model || 'gemini-1.5-flash',
      chatLanguage: settings.chat_language || 'BH'
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

    const langInstructions = {
      'AR': 'أجب باللغة العربية حصراً. استخدم مصطلحات الموارد البشرية الاحترافية.',
      'EN': 'Response MUST be in English exclusively. Use professional HR terminology.',
      'BH': 'أجب بنفس لغة سؤال المستخدم (عربي/إنجليزي). إذا كان السؤال هجيناً، أجب بلغة الأغلبية أو العربية كافتراضي.'
    };

    const systemPrompt = `You are an AI Recruitment Specialist (RAG-Enabled) for the "AI Recruitment Intelligence System".
${langInstructions[settings.chatLanguage as keyof typeof langInstructions] || langInstructions.BH}

=== Retrieve Documents Context (RAG) ===
${ragContext || 'No exact matches found in CV database.'}

=== Current Job Openings ===
${jobsSummary || 'No jobs currently active.'}

=== Top Candidate Analysis Overview ===
${analysisSummary || 'No candidate analyses available yet.'}

=== Guiding Instructions ===
1. LANGUAGE: Follow the specific language instruction: "${langInstructions[settings.chatLanguage as keyof typeof langInstructions] || langInstructions.BH}".
2. ACCURACY: Use the provided RAG context to answer specific CV details. If the info is missing, state it clearly.
3. COMPARISON: Use the Analysis Overview to compare candidates based on final_score and cultural_fit_score.
4. TONE: Maintain a professional, executive recruitment tone.
5. FORMATTING: Use markdown (bold, lists) for readability.
6. BILINGUAL SUPPORT: If the user refers to an English job title in an Arabic prompt, maintain the technical terms correctly.`;

    // Gemini Conversation History
    const chatHistory = history.map(h => ({
      role: h.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: h.text }]
    }));

    try {
      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: 'System context: ' + systemPrompt }] },
          { role: 'model', parts: [{ text: settings.chatLanguage === 'EN' ? 'Understood. I have access to the vector database and recruitment context. How can I assist you?' : 'فهمت. أنا متصل الآن بقاعدة بيانات المتجهات وجاهز لتحليل السير الذاتية وتقديم إجابات دقيقة بناءً على المحتوى المسترجع ولغة التواصل المفضلة. كيف يمكنني مساعدتك اليوم؟' }] },
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
