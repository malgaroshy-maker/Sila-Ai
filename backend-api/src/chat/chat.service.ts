import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SupabaseService } from '../supabase.service';
import { AiService } from '../ai/ai.service';
import { EmailService } from '../email/email.service';
import { generateBilingualEmail } from '../email/email-templates';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly aiService: AiService,
    private readonly emailService: EmailService,
  ) {}

  async chat(
    userEmail: string,
    message: string,
    history: { role: string; text: string }[],
    sessionId?: string,
  ) {
    const sb = this.supabaseService.getClient();
    const settings = await this.aiService.getSettings(userEmail);

    // 0. Session Handling: Ensure we have a session to save to
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const { data: newSession } = await sb
        .from('chat_sessions')
        .insert({
          user_email: userEmail,
          title: message.slice(0, 40) + (message.length > 40 ? '...' : ''),
        })
        .select()
        .single();
      activeSessionId = newSession?.id;
    } else {
      // Update session timestamp
      await sb
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeSessionId);
    }

    // Save user message
    if (activeSessionId) {
      await sb.from('chat_messages').insert({
        session_id: activeSessionId,
        role: 'user',
        content: message,
      });
    }
    const genAI = new GoogleGenerativeAI(settings.apiKey);
    const model = genAI.getGenerativeModel({ model: settings.model });

    // 1. RAG Step: Search for relevant candidate CV snippets using Vector DB
    let ragContext = '';
    let matchedCount = 0;
    try {
      const queryEmbedding = await this.aiService.generateEmbedding(
        userEmail,
        message,
      );
      const { data: matched, error: matchError } = await sb.rpc(
        'hybrid_match_candidates',
        {
          query_text: message,
          query_embedding: queryEmbedding,
          match_threshold: 0.1,
          match_count: 5,
          full_text_weight: 1.5, // Prioritize keyword matches slightly
          semantic_weight: 1.0,
          user_email_filter: userEmail,
        },
      );

      if (matched && matched.length > 0) {
        matchedCount = matched.length;

        // Fetch candidate names for the matched IDs
        const candidateIds = matched.map((m: any) => m.candidate_id);
        const { data: candidateNames } = await sb
          .from('candidates')
          .select('id, name')
          .in('id', candidateIds);

        const nameMap = new Map(
          candidateNames?.map((c) => [c.id, c.name]) || [],
        );

        ragContext = matched
          .map(
            (m: any) =>
              `[Candidate: ${nameMap.get(m.candidate_id) || 'Unknown'}]\n${m.content}`,
          )
          .join('\n---\n');
      }
    } catch (e) {
      this.logger.error(`RAG retrieval failed: ${e.message}`);
    }

    // 2. Metadata Step: Fetch basic jobs and analysis overview for the user
    const [jobsRes, analysisRes] = await Promise.all([
      sb.from('jobs').select('*').eq('user_email', userEmail),
      sb
        .from('analysis_results')
        .select(
          '*, applications!inner(job_id, candidate_id, jobs!inner(title, user_email), candidates!inner(name, email))',
        )
        .eq('applications.jobs.user_email', userEmail)
        .order('created_at', { ascending: false })
        .limit(20), // Limit to top 20 latest/best analyses for general context
    ]);

    const jobs = jobsRes.data || [];
    const analyses = analysisRes.data || [];

    // Build context summaries
    const jobsSummary = jobs
      .map((j) => `- "${j.title}" (ID: ${j.id}): ${j.description}`)
      .join('\n');
    const analysisSummary = analyses
      .map((a) => {
        const name = a.applications?.candidates?.name || 'Unknown';
        const job = a.applications?.jobs?.title || 'Unknown Job';
        const isGrad = a.is_fresh_graduate ? '🎓 Fresh Grad' : 'Professional';
        const appId = a.application_id;
        return `- ${name} (AppID: ${appId}) | ${isGrad} | Job: "${job}" | Score: ${a.final_score}/100 | Fit: ${a.cultural_fit_score}/100 | Tags: ${a.tags?.join(', ')}`;
      })
      .join('\n');

    const langInstructions = {
      AR: 'أجب باللغة العربية حصراً. استخدم مصطلحات الموارد البشرية الاحترافية.',
      EN: 'Response MUST be in English exclusively. Use professional HR terminology.',
      BH: 'أجب بنفس لغة سؤال المستخدم (عربي/إنجليزي). إذا كان السؤال هجيناً، أجب بلغة الأغلبية أو العربية كافتراضي.',
    };

    const chatLanguage = (settings as any).chat_language || 'BH';
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const todayAr = new Date().toLocaleDateString('ar-BH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const systemPrompt = `You are an AI Recruitment Specialist (RAG-Enabled) for the "AI Recruitment Intelligence System".
Today is: ${today} (${todayAr}).
${langInstructions[chatLanguage as keyof typeof langInstructions] || langInstructions.BH}

=== Retrieve Documents Context (RAG) ===
${ragContext || 'No exact matches found in CV database.'}

=== Current Job Openings ===
${jobsSummary || 'No jobs currently active.'}

=== Top Candidate Analysis Overview ===
${analysisSummary || 'No candidate analyses available yet.'}

=== Guiding Instructions ===
1. LANGUAGE: Follow the specific language instruction: "${langInstructions[chatLanguage as keyof typeof langInstructions] || langInstructions.BH}".
2. ACCURACY: Use the provided RAG context to answer specific CV details. If the info is missing, state it clearly.
3. COMPSILAON: Use the Analysis Overview to compare candidates based on final_score and cultural_fit_score.
4. TONE: Maintain a professional, executive recruitment tone.
5. FORMATTING: Use markdown (bold, lists) for readability.
6. BILINGUAL SUPPORT: If the user refers to an English job title in an Arabic prompt, maintain the technical terms correctly.
7. CANDIDATE IDENTIFICATION: Refer to candidates by their full name in your conversation. DO NOT show technical IDs (like AppID or JobID) to the user. However, you MUST use the provided AppID or JobID when calling functions/tools.
8. DATA OUTPUT FORMAT: For all candidates, output only the Name and Key Metrics. Do not include technical UUIDs in your text response to the user.`;

    // Gemini Conversation History for the fetch wrapper (stateless multi-turn)
    const chatHistory = history.map((h) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }],
    }));

    const fullContents: any[] = [
      { role: 'user', parts: [{ text: 'System context: ' + systemPrompt }] },
      {
        role: 'model',
        parts: [
          {
            text:
              chatLanguage === 'EN'
                ? 'Understood. I have access to the vector database and recruitment context. How can I assist you?'
                : 'فهمت. أنا متصل الآن بقاعدة بيانات المتجهات وجاهز لتحليل السير الذاتية وتقديم إجابات دقيقة بناءً على المحتوى المسترجع ولغة التواصل المفضلة. كيف يمكنني مساعدتك اليوم؟',
          },
        ],
      },
      ...chatHistory,
      { role: 'user', parts: [{ text: message }] },
    ];

    const tools = [
      {
        function_declarations: [
          {
            name: 'update_candidate_stage',
            description:
              'Updates the pipeline stage of a candidate application (e.g., Screening, Interview, Offered, Hired, Rejected).',
            parameters: {
              type: 'object',
              properties: {
                application_id: {
                  type: 'string',
                  description: 'The UUID of the application to update.',
                },
                stage: {
                  type: 'string',
                  description:
                    'The new stage name. Valid values: Applied, Screening, Interview, Offered, Hired, Rejected.',
                },
              },
              required: ['application_id', 'stage'],
            },
          },
          {
            name: 'update_job_requirements',
            description: 'Updates the requirements list for a specific job.',
            parameters: {
              type: 'object',
              properties: {
                job_id: {
                  type: 'string',
                  description: 'The UUID of the job to update.',
                },
                requirements: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'The new list of requirements.',
                },
              },
              required: ['job_id', 'requirements'],
            },
          },
          {
            name: 'generate_interview_guide',
            description:
              'Generates a customized interview rubric and questions based on candidate analysis.',
            parameters: {
              type: 'object',
              properties: {
                application_id: {
                  type: 'string',
                  description: 'The UUID of the candidate application.',
                },
              },
              required: ['application_id'],
            },
          },
          {
            name: 'send_rejection_email',
            description:
              'Drafts and sends a personalized bilingual rejection email for a candidate based on their AI analysis.',
            parameters: {
              type: 'object',
              properties: {
                application_id: {
                  type: 'string',
                  description: 'The UUID of the candidate application.',
                },
              },
              required: ['application_id'],
            },
          },
          {
            name: 'send_interview_email',
            description:
              'Sends a professional bilingual interview invitation email to a candidate. ALWAYS use Western numerals (0-9) even in Arabic content.',
            parameters: {
              type: 'object',
              properties: {
                application_id: {
                  type: 'string',
                  description: 'The UUID of the candidate application.',
                },
                interview_date_en: {
                  type: 'string',
                  description:
                    'The date and time in English (e.g., "Monday, Oct 20 at 2 PM"). Use Western digits 0-9.',
                },
                interview_date_ar: {
                  type: 'string',
                  description:
                    'The date and time in Arabic. YOU MUST USE WESTERN DIGITS 0-9 (e.g. "الإثنين، 20 أكتوبر في 2 مساءً"). DO NOT use ٠١٢٣.',
                },
                interview_location_en: {
                  type: 'string',
                  description:
                    'The location or mode in English (e.g., "Office HQ", "Microsoft Teams").',
                },
                interview_location_ar: {
                  type: 'string',
                  description:
                    'The location or mode in Arabic (e.g., "مقر الشركة", "تيمز").',
                },
                interview_type_en: {
                  type: 'string',
                  description:
                    'Type of interview in English (e.g. "Technical Round", "Initial Screening").',
                },
                interview_type_ar: {
                  type: 'string',
                  description:
                    'Type of interview in Arabic (e.g. "جولة تقنية", "مقابلة أولية").',
                },
                duration_en: {
                  type: 'string',
                  description: 'Optional duration in English (e.g. "45 minutes").',
                },
                duration_ar: {
                  type: 'string',
                  description: 'Optional duration in Arabic (e.g. "45 دقيقة"). Use Western digits.',
                },
                interviewer_names_en: {
                  type: 'string',
                  description: 'Optional names of interviewers in English.',
                },
                interviewer_names_ar: {
                  type: 'string',
                  description: 'Optional names of interviewers in Arabic.',
                },
                rescheduling_contact: {
                  type: 'string',
                  description: 'Optional email or phone for rescheduling.',
                },
                optional_notes_en: {
                  type: 'string',
                  description: 'Any additional notes in English.',
                },
                optional_notes_ar: {
                  type: 'string',
                  description: 'Any additional notes in Arabic. Use Western digits.',
                },
                interview_link: {
                  type: 'string',
                  description: 'Optional video call link.',
                },
              },
              required: [
                'application_id',
                'interview_date_en',
                'interview_date_ar',
                'interview_location_en',
                'interview_location_ar',
                'interview_type_en',
                'interview_type_ar',
              ],
            },
          },
          {
            name: 'send_offer_email',
            description:
              'Sends a formal bilingual job offer email to a candidate.',
            parameters: {
              type: 'object',
              properties: {
                application_id: {
                  type: 'string',
                  description: 'The UUID of the candidate application.',
                },
                salary: {
                  type: 'string',
                  description: 'The proposed annual salary.',
                },
                start_date: {
                  type: 'string',
                  description: 'The proposed start date.',
                },
              },
              required: ['application_id', 'salary', 'start_date'],
            },
          },
          {
            name: 'cross_match_candidate',
            description:
              'Checks if a candidate is a good fit for other open positions in the company.',
            parameters: {
              type: 'object',
              properties: {
                application_id: {
                  type: 'string',
                  description: 'The UUID of the candidate application.',
                },
              },
              required: ['application_id'],
            },
          },
          {
            name: 'salary_benchmarking',
            description:
              'Provides a recommended salary range for a candidate based on their skills and the job role.',
            parameters: {
              type: 'object',
              properties: {
                application_id: {
                  type: 'string',
                  description: 'The UUID of the candidate application.',
                },
              },
              required: ['application_id'],
            },
          },
          {
            name: 'hiring_risk_assessment',
            description:
              'Identifies potential red flags or risks associated with hiring a specific candidate.',
            parameters: {
              type: 'object',
              properties: {
                application_id: {
                  type: 'string',
                  description: 'The UUID of the candidate application.',
                },
              },
              required: ['application_id'],
            },
          },
          {
            name: 'bulk_archive_candidates',
            description:
              'Archives all candidates for a specific job whose final score is below a certain threshold.',
            parameters: {
              type: 'object',
              properties: {
                job_id: {
                  type: 'string',
                  description: 'The UUID of the job.',
                },
                threshold_score: {
                  type: 'number',
                  description:
                    'Candidates with a score strictly below this will be archived (marked as Rejected).',
                },
              },
              required: ['job_id', 'threshold_score'],
            },
          },
          {
            name: 'find_duplicate_candidates',
            description:
              'Searches for duplicate candidate profiles based on name or email.',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The name or email to search for.',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'export_candidate_report',
            description:
              'Generates a comprehensive summary report for a candidate application.',
            parameters: {
              type: 'object',
              properties: {
                application_id: {
                  type: 'string',
                  description: 'The UUID of the candidate application.',
                },
              },
              required: ['application_id'],
            },
          },
        ],
      },
    ];

    try {
      let result = await this.aiService.fetchGeminiWithQuota(
        userEmail,
        fullContents,
        undefined,
        undefined,
        undefined,
        tools,
      );

      // Handle Function Calling Loop (max 2 turns to prevent infinite loops)
      let turn = 0;
      while (
        result.candidates?.[0]?.content?.parts?.some(
          (p: any) => p.functionCall,
        ) &&
        turn < 2
      ) {
        turn++;
        const parts = result.candidates[0].content.parts;
        const functionCalls = parts.filter((p: any) => p.functionCall);
        const functionResponses = [];

        for (const fc of functionCalls) {
          const call = fc.functionCall;
          this.logger.log(`AI triggering function: ${call.name}`);
          const response = await this.handleFunctionCall(userEmail, call);
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: response,
            },
          });
        }

        // Add the model's function call to history
        fullContents.push({
          role: 'model',
          parts: parts,
        });

        // Add the tool's response to history
        fullContents.push({
          role: 'function',
          parts: functionResponses,
        });

        // Fetch again with the responses
        result = await this.aiService.fetchGeminiWithQuota(
          userEmail,
          fullContents,
          undefined,
          undefined,
          undefined,
          tools,
        );
      }

      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) throw new Error('Empty response from AI');

      // Log usage for the chat message
      await this.aiService.logUsage(
        userEmail,
        'chat',
        result.usageMetadata,
        settings.model,
      );

      this.logger.log(
        `Chat RAG: "${message.slice(0, 50)}..." → ${matchedCount} matches found`,
      );

      // --- Context-Aware Suggestions Logic ---
      const suggestedActions: any[] = [];

      // Determine context from RAG and analyses
      const mentionedCandidate = analyses.find(
        (a) =>
          message
            .toLowerCase()
            .includes((a.applications?.candidates?.name || '').toLowerCase()) ||
          responseText
            .toLowerCase()
            .includes((a.applications?.candidates?.name || '').toLowerCase()),
      );

      if (mentionedCandidate) {
        const score = mentionedCandidate.final_score;
        const name = mentionedCandidate.applications.candidates.name;

        if (score >= 80) {
          suggestedActions.push({
            label: `Schedule Interview for ${name}`,
            prompt: `I'd like to schedule an interview for ${name}. What's the best way to proceed?`,
            action: 'send_interview_email',
          });
        } else if (score < 40) {
          suggestedActions.push({
            label: `Reject ${name}`,
            prompt: `Draft a polite rejection email for ${name} based on our analysis.`,
            action: 'send_rejection_email',
          });
        }

        suggestedActions.push({
          label: `Generate Scorecard for ${name}`,
          prompt: `Show me the full breakdown and scorecard for ${name}.`,
          action: 'export_candidate_report',
        });
      } else if (
        message.toLowerCase().includes('job') ||
        message.toLowerCase().includes('وظيفة')
      ) {
        suggestedActions.push({
          label: 'Compare Top Candidates',
          prompt: 'Who are the top 3 candidates across all open positions?',
        });
      }

      // Save assistant message with metadata
      if (activeSessionId) {
        await sb.from('chat_messages').insert({
          session_id: activeSessionId,
          role: 'assistant',
          content: responseText,
          metadata: { suggestions: suggestedActions },
        });
      }

      return {
        response: responseText,
        sessionId: activeSessionId,
        suggestions: suggestedActions,
      };
    } catch (error: any) {
      this.logger.error('Chat error:', error.message);
      return {
        response: 'عذراً، حدث خطأ في معالجة طلبك عبر نظام RAG. حاول مرة أخرى.',
      };
    }
  }

  async getSessions(userEmail: string) {
    const sb = this.supabaseService.getClient();
    const { data, error } = await sb
      .from('chat_sessions')
      .select('*')
      .eq('user_email', userEmail)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getMessages(userEmail: string, sessionId: string) {
    const sb = this.supabaseService.getClient();
    // Verify ownership via join
    const { data: session } = await sb
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_email', userEmail)
      .single();

    if (!session) throw new Error('Session not found or access denied');

    const { data, error } = await sb
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  async deleteSession(userEmail: string, sessionId: string) {
    const sb = this.supabaseService.getClient();
    const { error } = await sb
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_email', userEmail);

    if (error) throw error;
    return { success: true };
  }

  private async resolveApplicationId(
    sb: any,
    id: string,
    userEmail: string,
  ): Promise<string | null> {
    this.logger.log(`Attempting to resolve ID: ${id} for user: ${userEmail}`);

    // Clean the input: check if it's a concatenated string like UUID-Name
    const uuidMatch = id.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const cleanId = uuidMatch ? uuidMatch[0] : id.trim();

    // 1. Try directly as application_id
    const { data: appDirect } = await sb
      .from('applications')
      .select('id, jobs!inner(user_email)')
      .eq('id', cleanId)
      .eq('jobs.user_email', userEmail)
      .maybeSingle();

    if (appDirect) return appDirect.id;

    // 2. Try as analysis_result_id
    const { data: appFromAnalysis } = await sb
      .from('analysis_results')
      .select('application_id, applications!inner(jobs!inner(user_email))')
      .eq('id', cleanId)
      .eq('applications.jobs.user_email', userEmail)
      .maybeSingle();

    if (appFromAnalysis) return appFromAnalysis.application_id;

    // 3. Try as candidate_id (get latest application)
    const { data: appFromCandidate } = await sb
      .from('applications')
      .select('id, jobs!inner(user_email)')
      .eq('candidate_id', cleanId)
      .eq('jobs.user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (appFromCandidate) return appFromCandidate.id;
    
    // 4. Try as candidate name (exact/fuzzy matching)
    // Use the original 'id' string for name matching in case it's actually a name
    this.logger.log(`Attempting resolution by Candidate Name: ${id}`);
    const nameToMatch = uuidMatch ? id.replace(uuidMatch[0], '').replace(/^[-\s]+|[-\s]+$/g, '') : id.trim();
    
    const { data: appFromName } = await sb
      .from('applications')
      .select('id, candidates!inner(name), jobs!inner(user_email)')
      .ilike('candidates.name', `%${(nameToMatch || id).trim()}%`)
      .eq('jobs.user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (appFromName) {
      this.logger.log(`Resolved ${id} to application ID: ${appFromName.id} via Name Match`);
      return appFromName.id;
    }

    return null;
  }

  private async handleFunctionCall(userEmail: string, call: any) {
    const sb = this.supabaseService.getClient();

    try {
      if (call.name === 'update_candidate_stage') {
        const { application_id, stage } = call.args;
        const resolvedId = await this.resolveApplicationId(
          sb,
          application_id,
          userEmail,
        );

        if (!resolvedId)
          throw new Error(
            `Could not find application record for ID: ${application_id}`,
          );

        this.logger.log(`Moving application ${resolvedId} to ${stage}`);
        const { data, error } = await sb
          .from('applications')
          .update({ pipeline_stage: stage })
          .eq('id', resolvedId)
          .select()
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new Error(`Application ${resolvedId} not found.`);

        return {
          status: 'success',
          message: `Candidate moved to ${stage}.`,
          data: data,
        };
      }

      if (call.name === 'update_job_requirements') {
        const { job_id, requirements } = call.args;
        const { data, error } = await sb
          .from('jobs')
          .update({ requirements })
          .eq('id', job_id)
          .eq('user_email', userEmail)
          .select()
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new Error(`Job ${job_id} not found or access denied.`);

        return {
          status: 'success',
          message: `Job requirements updated.`,
          data: data,
        };
      }

      if (
        call.name === 'generate_interview_guide' ||
        call.name === 'send_rejection_email' ||
        call.name === 'send_interview_email' ||
        call.name === 'send_offer_email' ||
        call.name === 'cross_match_candidate' ||
        call.name === 'salary_benchmarking' ||
        call.name === 'hiring_risk_assessment' ||
        call.name === 'export_candidate_report'
      ) {
        const { application_id } = call.args;
        const resolvedId = await this.resolveApplicationId(
          sb,
          application_id,
          userEmail,
        );

        if (!resolvedId) {
          this.logger.warn(
            `App not found for ${application_id} (User: ${userEmail})`,
          );
          throw new Error(
            'Could not find application data for this ID or access denied.',
          );
        }

        this.logger.log(
          `Function: ${call.name} called for resolved application: ${resolvedId} (User: ${userEmail})`,
        );

        // Fetch full candidate analysis and job details
        const { data: app, error } = await sb
          .from('analysis_results')
          .select(
            '*, applications!inner(id, job_id, candidate_id, jobs!inner(title, description, requirements, user_email), candidates!inner(name, email))',
          )
          .eq('application_id', resolvedId)
          .maybeSingle();

        if (error) {
          this.logger.error(
            `Database error for ${resolvedId}: ${error.message}`,
          );
          throw new Error(`Database error: ${error.message}`);
        }
        if (!app) {
          this.logger.warn(`Analysis not found for ${resolvedId}`);
          throw new Error('Could not find analysis data for this candidate.');
        }

        // Fetch company name from settings for branding
        const { data: companySetting } = await sb
          .from('settings')
          .select('value')
          .eq('user_email', userEmail)
          .eq('key', 'company_name')
          .maybeSingle();
        const companyName = companySetting?.value || 'SILA Recruitment';

        if (call.name === 'generate_interview_guide') {
          return {
            status: 'success',
            guide_data: {
              candidate: app.applications.candidates.name,
              job: app.applications.jobs.title,
              rubric: app.interview_questions,
              weaknesses_to_probe: app.weaknesses,
              focus_areas: app.tags,
            },
            message: `Interview guide generated for ${app.applications.candidates.name}.`,
          };
        }

        if (call.name === 'send_rejection_email') {
          const { subject, html } = generateBilingualEmail('rejection', {
            candidateName: app.applications.candidates.name,
            jobTitle: app.applications.jobs.title,
            companyName: companyName,
            strengths: app.tags,
            requirements: app.applications.jobs.requirements,
          });

          this.logger.log(
            `Actually sending rejection email to ${app.applications.candidates.email}`,
          );
          await this.emailService.sendEmail(
            userEmail,
            app.applications.candidates.email,
            subject,
            html,
          );

          return {
            status: 'success',
            message: `Bilingual rejection email successfully sent to ${app.applications.candidates.name}.`,
          };
        }

        if (call.name === 'send_interview_email') {
          const {
            interview_date_en,
            interview_date_ar,
            interview_location_en,
            interview_location_ar,
            interview_link,
            interview_type_en,
            interview_type_ar,
            duration_en,
            duration_ar,
            interviewer_names_en,
            interviewer_names_ar,
            rescheduling_contact,
            optional_notes_en,
            optional_notes_ar,
          } = call.args;

          const { subject, html } = generateBilingualEmail('interview', {
            candidateName: app.applications.candidates.name,
            jobTitle: app.applications.jobs.title,
            companyName: companyName,
            details: {
              dateEn: interview_date_en,
              dateAr: interview_date_ar,
              locationEn: interview_location_en,
              locationAr: interview_location_ar,
              typeEn: interview_type_en,
              typeAr: interview_type_ar,
              link: interview_link,
              durationEn: duration_en,
              durationAr: duration_ar,
              interviewersEn: interviewer_names_en,
              interviewersAr: interviewer_names_ar,
              reschedulingContact: rescheduling_contact,
              notesEn: optional_notes_en,
              notesAr: optional_notes_ar,
            },
          });

          await this.emailService.sendEmail(
            userEmail,
            app.applications.candidates.email,
            subject,
            html,
          );
          return {
            status: 'success',
            message: `Bilingual interview invitation sent to ${app.applications.candidates.name} for ${interview_date_en} at ${interview_location_en}.`,
          };
        }

        if (call.name === 'send_offer_email') {
          const { salary, start_date } = call.args;
          const { subject, html } = generateBilingualEmail('offer', {
            candidateName: app.applications.candidates.name,
            jobTitle: app.applications.jobs.title,
            companyName: companyName,
            details: {
              salary,
              start_date,
            },
          });

          await this.emailService.sendEmail(
            userEmail,
            app.applications.candidates.email,
            subject,
            html,
          );
          return {
            status: 'success',
            message: `Bilingual offer letter sent to ${app.applications.candidates.name} with salary ${salary}.`,
          };
        }

        if (call.name === 'cross_match_candidate') {
          const { data: otherJobs } = await sb
            .from('jobs')
            .select('title, description, requirements')
            .eq('user_email', userEmail)
            .neq('id', app.applications.job_id);

          return {
            status: 'success',
            candidate: {
              name: app.applications.candidates.name,
              skills: app.tags,
              score: app.final_score,
            },
            other_positions: otherJobs || [],
            message: `Found ${otherJobs?.length || 0} other potential roles for ${app.applications.candidates.name}.`,
          };
        }

        if (call.name === 'salary_benchmarking') {
          return {
            status: 'success',
            candidate_stats: {
              name: app.applications.candidates.name,
              role: app.applications.jobs.title,
              skills: app.tags,
              is_fresh_grad: app.is_fresh_graduate,
              score: app.final_score,
            },
            message: `Salary benchmark data retrieved for ${app.applications.candidates.name}.`,
          };
        }

        if (call.name === 'hiring_risk_assessment') {
          return {
            status: 'success',
            candidate: app.applications.candidates.name,
            weaknesses: app.weaknesses,
            flags: app.flags,
            trajectory: app.career_trajectory,
            message: `Risk assessment data compiled for ${app.applications.candidates.name}.`,
          };
        }

        if (call.name === 'export_candidate_report') {
          const backendUrl =
            process.env.BACKEND_URL ||
            process.env.RENDER_EXTERNAL_URL ||
            'https://ai-cv-scan.onrender.com';

          return {
            status: 'success',
            application_id: application_id,
            download_url: `${backendUrl}/reports/application/${application_id}/pdf?email=${userEmail}`,
            message: `Candidate report for ${app.applications.candidates.name} has been successfully generated. You can download it using the link provided.`,
          };
        }
      }

      if (call.name === 'bulk_archive_candidates') {
        const { job_id, threshold_score } = call.args;
        // Find applications to archive (score < threshold)
        const { data: toArchive } = await sb
          .from('analysis_results')
          .select('application_id')
          .lt('final_score', threshold_score)
          .eq('applications.job_id', job_id);

        if (toArchive && toArchive.length > 0) {
          const ids = toArchive.map((a) => a.application_id);
          const { error } = await sb
            .from('applications')
            .update({ pipeline_stage: 'Rejected' })
            .in('id', ids);

          if (error) throw new Error(error.message);
          return {
            status: 'success',
            archived_count: ids.length,
            message: `Successfully archived ${ids.length} candidates with scores below ${threshold_score}.`,
          };
        }
        return {
          status: 'success',
          archived_count: 0,
          message: `No candidates found with scores below ${threshold_score}.`,
        };
      }

      if (call.name === 'find_duplicate_candidates') {
        const { query } = call.args;
        const { data: dupes } = await sb
          .from('candidates')
          .select('id, name, email')
          .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(5);

        return {
          status: 'success',
          duplicates: dupes || [],
          message: `Found ${dupes?.length || 0} candidate(s) matching "${query}".`,
        };
      }

      return { status: 'error', message: 'Unknown function call.' };
    } catch (e: any) {
      this.logger.error(`Function execution failed: ${e.message}`);
      return { status: 'error', message: e.message };
    }
  }
}
