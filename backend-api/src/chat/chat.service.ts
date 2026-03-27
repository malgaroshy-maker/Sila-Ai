import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
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

  async chat(
    userEmail: string,
    message: string,
    history: { role: string; text: string }[],
  ) {
    const sb = this.supabaseService.getClient();
    const settings = await this.aiService.getSettings(userEmail);
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
        ragContext = matched
          .map(
            (m: any) =>
              `[Candidate CV Snippet - ID: ${m.candidate_id}]\n${m.content}`,
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
        return `- ${name} (${isGrad}) | Job: "${job}" | Score: ${a.final_score}/100 | Fit: ${a.cultural_fit_score}/100 | Trajectory: ${a.career_trajectory} | Tags: ${a.tags?.join(', ')}`;
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
6. BILINGUAL SUPPORT: If the user refers to an English job title in an Arabic prompt, maintain the technical terms correctly.`;

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
              'Drafts a personalized rejection email for a candidate based on their AI analysis.',
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
      return { response: responseText };
    } catch (error: any) {
      this.logger.error('Chat error:', error.message);
      return {
        response: 'عذراً، حدث خطأ في معالجة طلبك عبر نظام RAG. حاول مرة أخرى.',
      };
    }
  }

  private async handleFunctionCall(userEmail: string, call: any) {
    const sb = this.supabaseService.getClient();

    try {
      if (call.name === 'update_candidate_stage') {
        const { application_id, stage } = call.args;
        this.logger.log(`Moving application ${application_id} to ${stage}`);
        const { data, error } = await sb
          .from('applications')
          .update({ pipeline_stage: stage })
          .eq('id', application_id)
          .select();
        
        this.logger.log(`Update result data: ${JSON.stringify(data)}`);
        
        const updatedApp = Array.isArray(data) ? data[0] : data;

        if (error) throw new Error(error.message);
        return {
          status: 'success',
          message: `Candidate moved to ${stage}.`,
          data: updatedApp,
        };
      }

      if (call.name === 'update_job_requirements') {
        const { job_id, requirements } = call.args;
        const { data, error } = await sb
          .from('jobs')
          .update({ requirements })
          .eq('id', job_id)
          .eq('user_email', userEmail)
          .select();

        if (error) throw new Error(error.message);
        const updatedJob = Array.isArray(data) ? data[0] : data;
        return {
          status: 'success',
          message: `Job requirements updated.`,
          data: updatedJob,
        };
      }

      if (
        call.name === 'generate_interview_guide' ||
        call.name === 'send_rejection_email' ||
        call.name === 'cross_match_candidate' ||
        call.name === 'salary_benchmarking' ||
        call.name === 'hiring_risk_assessment'
      ) {
        const { application_id } = call.args;
        // Fetch full candidate analysis and job details
        const { data: app, error } = await sb
          .from('analysis_results')
          .select(
            '*, applications!inner(id, job_id, candidate_id, jobs!inner(title, description, requirements, user_email), candidates!inner(name, email))',
          )
          .eq('application_id', application_id)
          .eq('applications.jobs.user_email', userEmail)
          .maybeSingle();

        if (error) throw new Error(`Database error: ${error.message}`);
        if (!app) throw new Error('Could not find analysis data for this candidate or access denied.');

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
          return {
            status: 'success',
            draft: {
              to: app.applications.candidates.email,
              subject: `Update on your application for ${app.applications.jobs.title}`,
              body: `Dear ${app.applications.candidates.name}, thank you for your interest in the ${app.applications.jobs.title} role. While we were impressed with your ${app.tags?.slice(0, 2).join(' and ')}, we've decided to move forward with other candidates whose profiles more closely align with our current focus on ${app.applications.jobs.requirements?.slice(0, 2).join(' and ')}.`,
            },
            message: `Rejection draft prepared for ${app.applications.candidates.name}.`,
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

      if (call.name === 'export_candidate_report') {
        const { application_id } = call.args;
        // In a real scenario, this would trigger the Puppeteer PDF generation endpoint
        return {
          status: 'success',
          application_id: application_id,
          download_url: `/api/reports/download/${application_id}`, // Placeholder
          message:
            'Candidate report generation initiated. You can download it once it is ready.',
        };
      }

      return { status: 'error', message: 'Unknown function call.' };
    } catch (e: any) {
      this.logger.error(`Function execution failed: ${e.message}`);
      return { status: 'error', message: e.message };
    }
  }
}
