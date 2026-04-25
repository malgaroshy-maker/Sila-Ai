import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import { AiService } from '../ai/ai.service';
import { TwilioService } from './twilio.service';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly aiService: AiService,
    private readonly twilioService: TwilioService,
  ) {}

  async startVerification(applicationId: string, userEmail: string) {
    const sb = this.supabaseService.getAdminClient();
    const settings = await this.aiService.getSettings(userEmail);

    if (settings.whatsapp_enabled !== 'true') {
      throw new Error('WhatsApp verification is not enabled in settings.');
    }

    const twilioSid = settings.whatsapp_twilio_sid;
    const twilioToken = settings.whatsapp_twilio_token;
    const twilioFrom = settings.whatsapp_twilio_from;

    if (!twilioSid || !twilioToken || !twilioFrom) {
      throw new Error('Twilio credentials are not configured.');
    }

    // Fetch the application
    const { data: appData, error: appErr } = await sb
      .from('applications')
      .select('id, job_id, candidate_id')
      .eq('id', applicationId)
      .maybeSingle();

    if (appErr) throw new Error(`Database error: ${appErr.message}`);
    if (!appData) throw new Error('Application not found.');

    // Verify the job belongs to this user
    const { data: jobData } = await sb
      .from('jobs')
      .select('id, title')
      .eq('id', appData.job_id)
      .eq('user_email', userEmail)
      .maybeSingle();

    if (!jobData) throw new Error('Job not found or access denied.');

    // Fetch candidate info
    const { data: candidateData } = await sb
      .from('candidates')
      .select('id, name, phone')
      .eq('id', appData.candidate_id)
      .maybeSingle();

    if (!candidateData) throw new Error('Candidate not found.');
    if (!candidateData.phone) throw new Error('No phone number found for this candidate.');

    const phone = candidateData.phone;
    const candidateName = candidateData.name;
    const jobTitle = jobData.title || null;
    const candidateId = appData.candidate_id;
    const jobId = appData.job_id;

    // Check for existing session
    const { data: existingSession } = await sb
      .from('whatsapp_verification_sessions')
      .select('id, status')
      .eq('application_id', applicationId)
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSession && !['completed', 'expired', 'candidate_declined'].includes(existingSession.status)) {
      throw new Error(`An active verification session already exists for this candidate (status: ${existingSession.status}).`);
    }

    // Create session
    const { data: session, error: sessionErr } = await sb
      .from('whatsapp_verification_sessions')
      .insert({
        application_id: applicationId,
        candidate_id: candidateId,
        job_id: jobId,
        user_email: userEmail,
        phone_number: phone,
        status: 'pending',
      })
      .select()
      .single();

    if (sessionErr) throw new Error(`Failed to create session: ${sessionErr.message}`);
    if (!session) throw new Error('Failed to create verification session.');

    // Build consent message
    const consentMsg = this.buildConsentMessage(candidateName, settings.companyName, jobTitle);
    const twilioResult = await this.twilioService.sendMessage(
      twilioSid, twilioToken, twilioFrom, phone, consentMsg,
    );

    // Update session
    await sb
      .from('whatsapp_verification_sessions')
      .update({
        status: 'consent_requested',
        twilio_message_sid: twilioResult.sid,
        session_started_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    return { sessionId: session.id, status: 'consent_requested', phone };
  }

  private buildConsentMessage(name: string, companyName: string | undefined, jobTitle: string | null): string {
    const firstName = name.split(' ')[0];
    let companyLine = '';

    if (companyName && companyName !== 'SILA AI' && jobTitle) {
      companyLine = `شركة ${companyName} حابة توظفك في منصب ${jobTitle}.\n`;
    } else if (jobTitle) {
      companyLine = `عندنا فرصة ${jobTitle} محتملة ليك.\n`;
    }

    return `السلام عليكم ${name}!\n${firstName}، معاك نظام صلة للتوظيف.\n${companyLine}عندك دقيقتين بالكثير توا باش نتحققو من المعلومات اللي في سيرتك الذاتية؟\nرد علي بـ "نعم" ولا "لا" باهي.`;
  }

  async handleIncomingMessage(fromPhone: string, body: string) {
    const sb = this.supabaseService.getAdminClient();

    const { data: session } = await sb
      .from('whatsapp_verification_sessions')
      .select('*')
      .eq('phone_number', fromPhone)
      .in('status', ['consent_requested', 'language_selected', 'availability_check', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      this.logger.log(`No active session for phone: ${fromPhone}`);
      return;
    }

    const settings = await this.aiService.getSettings(session.user_email);
    const twilioSid = settings.whatsapp_twilio_sid;
    const twilioToken = settings.whatsapp_twilio_token;
    const twilioFrom = settings.whatsapp_twilio_from;
    const questionCount = parseInt(settings.whatsapp_question_count || '4');
    const timeoutMinutes = parseInt(settings.whatsapp_timeout_minutes || '3');

    const response = body.trim();
    this.logger.log(`Handling message from ${fromPhone} — state: ${session.status}, response: "${response}"`);

    try {
      switch (session.status) {
        case 'consent_requested':
          return this.handleConsentResponse(sb, session, response, twilioSid, twilioToken, twilioFrom);
        case 'language_selected':
          return this.handleLanguageSelection(sb, session, response, twilioSid, twilioToken, twilioFrom);
        case 'availability_check':
          return this.handleAvailabilityResponse(sb, session, response, questionCount, twilioSid, twilioToken, twilioFrom, timeoutMinutes);
        case 'in_progress':
          return this.handleQuestionResponse(sb, session, response, questionCount, twilioSid, twilioToken, twilioFrom, timeoutMinutes);
      }
    } catch (error: any) {
      this.logger.error(`Error handling message: ${error.message}`);
    }
  }

  private async handleConsentResponse(
    sb: any, session: any, response: string,
    twilioSid: string, twilioToken: string, twilioFrom: string,
  ) {
    const isYes = response.toLowerCase().includes('نعم') || response.toLowerCase().includes('yes') || response.toLowerCase().includes('يب') || response.toLowerCase().includes('أيوا') || response.toLowerCase().includes('ايه') || response.toLowerCase().includes('باهي');

    if (isYes) {
      await sb.from('whatsapp_verification_sessions').update({ status: 'language_selected' }).eq('id', session.id);

      await this.twilioService.sendMessage(
        twilioSid, twilioToken, twilioFrom, session.phone_number,
        'باهي، قبل ما نبداو — شنو تفضل: نحكيو بالعربي ولا English؟',
      );
    } else {
      await sb.from('whatsapp_verification_sessions').update({ status: 'candidate_declined' }).eq('id', session.id);

      await this.twilioService.sendMessage(
        twilioSid, twilioToken, twilioFrom, session.phone_number,
        'مافيش مشكلة حبيبي، مشكور على وقتك. نتواصلو معاك بعدين ان شاء لله.',
      );
    }
  }

  private async handleLanguageSelection(
    sb: any, session: any, response: string,
    twilioSid: string, twilioToken: string, twilioFrom: string,
  ) {
    const wantsEnglish = /english|eng|en|انجليزي|انجلش|إنكليزي/i.test(response);
    const lang = wantsEnglish ? 'en' : 'ar';

    await sb.from('whatsapp_verification_sessions').update({
      status: 'availability_check',
      preferred_language: lang,
    }).eq('id', session.id);

    if (lang === 'en') {
      await this.twilioService.sendMessage(
        twilioSid, twilioToken, twilioFrom, session.phone_number,
        'Got it! Are you available now for a few quick questions? (Yes/No)',
      );
    } else {
      await this.twilioService.sendMessage(
        twilioSid, twilioToken, twilioFrom, session.phone_number,
        `باهي، توا نبي نسألك شوية أسئلة سريعة باش نتأكدو من خبرتك.\nشن رايك — جاهز توا ولا تحب نرجعو في وقت ثاني؟`,
      );
    }
  }

  private async handleAvailabilityResponse(
    sb: any, session: any, response: string, questionCount: number,
    twilioSid: string, twilioToken: string, twilioFrom: string, timeoutMinutes: number,
  ) {
    const isYes = response.toLowerCase().includes('نعم') || response.toLowerCase().includes('yes') ||
      response.toLowerCase().includes('جاهز') || response.toLowerCase().includes('توا') ||
      response.toLowerCase().includes('مستعد') || response.toLowerCase().includes('باهي');

    if (isYes) {
      // Generate questions
      const questions = await this.generateVerificationQuestions(session);

      // Save questions
      for (let i = 0; i < questions.length; i++) {
        await sb.from('verification_questions').insert({
          session_id: session.id,
          question_number: i + 1,
          question_text: questions[i].text,
          question_context: questions[i].verifies,
          expected_topics: questions[i].expected_topics,
        });
      }

      const lang = session.preferred_language || 'ar';

      await sb.from('whatsapp_verification_sessions').update({
        status: 'in_progress',
        current_question_index: 0,
        is_available_now: true,
        session_started_at: new Date().toISOString(),
      }).eq('id', session.id);

      // Send intro + first question
      const introMsg = lang === 'ar'
        ? `ماشي يا سيدها! خلينا نبدو.\nالمهم تجاوب بسرعة وبطريقة طبيعية، ومن غير ما تطلع على النت.\nيلا!\n\nسؤال 1 من ${questionCount}:\n${questions[0].text}`
        : `Alright! Let's begin.\nImportant: answer quickly and naturally, without looking up the internet.\nLet's go!\n\nQuestion 1 of ${questionCount}:\n${questions[0].text}`;

      await this.twilioService.sendMessage(twilioSid, twilioToken, twilioFrom, session.phone_number, introMsg);
    } else {
      await sb.from('whatsapp_verification_sessions').update({
        status: 'candidate_declined',
      }).eq('id', session.id);

      await this.twilioService.sendMessage(
        twilioSid, twilioToken, twilioFrom, session.phone_number,
        'مافيش مشكلة حبيبي، مشكور على وقتك. نتواصلو معاك بعدين ان شاء لله.',
      );
    }
  }

  private async handleQuestionResponse(
    sb: any, session: any, response: string, questionCount: number,
    twilioSid: string, twilioToken: string, twilioFrom: string, timeoutMinutes: number,
  ) {
    const now = new Date();

    // Get the current question
    const { data: questions } = await sb
      .from('verification_questions')
      .select('*')
      .eq('session_id', session.id)
      .order('question_number', { ascending: true });

    const currentIndex = session.current_question_index;
    const currentQuestion = questions?.[currentIndex];

    if (!currentQuestion) return;

    // Calculate response delay
    const lastMessageTime = currentIndex === 0
      ? new Date(session.session_started_at).getTime()
      : new Date(questions[currentIndex - 1]?.answered_at || session.session_started_at).getTime();
    const responseDelayMs = now.getTime() - lastMessageTime;

    // Update the question with answer
    await sb.from('verification_questions')
      .update({
        answer_text: response,
        answered_at: now.toISOString(),
        response_delay_ms: responseDelayMs,
      })
      .eq('id', currentQuestion.id);

    const nextIndex = currentIndex + 1;
    const lang = session.preferred_language || 'ar';

    if (nextIndex >= questionCount || nextIndex >= questions.length) {
      // All questions answered — analyze session
      await sb.from('whatsapp_verification_sessions').update({
        status: 'completed',
        current_question_index: nextIndex,
        session_ended_at: now.toISOString(),
      }).eq('id', session.id);

      // Closing message
      const closingMsg = lang === 'ar'
        ? `صحيت! خلصنا من الأسئلة.\nباهي، راح نراجعو إجاباتك ونتواصلو معاك في أقرب وقت على الخطوة الجاية.\nيعطيك الصحة على وقتك!`
        : `Thanks! We're done with the questions.\nWe'll review your answers and contact you soon about next steps.\nThank you for your time!`;

      await this.twilioService.sendMessage(twilioSid, twilioToken, twilioFrom, session.phone_number, closingMsg);

      // Run AI analysis
      this.analyzeSession(session.id).catch((err) =>
        this.logger.error(`Analysis failed for session ${session.id}: ${err.message}`),
      );
    } else {
      // Update index and send next question
      await sb.from('whatsapp_verification_sessions').update({
        current_question_index: nextIndex,
      }).eq('id', session.id);

      const nextQuestion = questions[nextIndex];
      const qMsg = lang === 'ar'
        ? `سؤال ${nextIndex + 1} من ${questionCount}:\n${nextQuestion.question_text}`
        : `Question ${nextIndex + 1} of ${questionCount}:\n${nextQuestion.question_text}`;

      await this.twilioService.sendMessage(twilioSid, twilioToken, twilioFrom, session.phone_number, qMsg);
    }
  }

  private async generateVerificationQuestions(session: any): Promise<any[]> {
    const sb = this.supabaseService.getAdminClient();
    const settings = await this.aiService.getSettings(session.user_email);
    const questionCount = parseInt(settings.whatsapp_question_count || '4');
    const lang = session.preferred_language || 'ar';

    // Fetch CV and job context
    const { data: candidate } = await sb
      .from('candidates')
      .select('cv_text, name')
      .eq('id', session.candidate_id)
      .single();

    const { data: job } = await sb
      .from('jobs')
      .select('title, requirements')
      .eq('id', session.job_id)
      .single();

    const cvSummary = (candidate?.cv_text || '').slice(0, 3000);
    const jobTitle = job?.title || '';
    const jobReqs = JSON.stringify(job?.requirements || []);

    const styleRules = lang === 'ar'
      ? `=== LANGUAGE STYLE (CRITICAL) ===
Write questions in natural Libyan Arabic dialect, NOT Modern Standard Arabic (Fusha).
Key rules:
- "شنو" not "ما" or "ماذا"
- "شن حالك" not "كيف حالك"
- "عندك" not "هل لديك"
- "نبي" not "أريد"
- "تبي" not "هل تريد"
- "هلبا" / "واجد" not "كثيراً"
- "شن رايك" not "ما رأيك"
- Conversational, warm, friendly tone — like talking to a friend
- Keep sentences short and natural`
      : 'Write questions in natural, conversational English. Keep them short and friendly.';

    const prompt = `You are an expert recruitment fraud detector. Generate ${questionCount} rapid-fire verification questions for a candidate who claims the following CV details:

=== CV Summary ===
${cvSummary}

=== Job Applied For ===
${jobTitle}: ${jobReqs}

=== Question Design Rules ===
1. Questions must verify REAL experience, not textbook knowledge
2. Ask about specifics that appear in their CV (projects, tools, years)
3. Make questions hard to answer via Google search (e.g., "Tell me about YOUR specific implementation of X" not "What is X?")
4. Keep each question under 2 sentences
5. Mix question types: behavioral, technical specifics, situational
6. DO NOT include any introductory text or numbering in the questions themselves
${styleRules}

=== Output Format ===
Return ONLY valid JSON:
{
  "questions": [
    {
      "text": "Question text",
      "verifies": "Which CV claim this targets",
      "expected_topics": ["topic1", "topic2"]
    }
  ]
}`;

    const schema = {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              verifies: { type: 'string' },
              expected_topics: { type: 'array', items: { type: 'string' } },
            },
            required: ['text', 'verifies', 'expected_topics'],
          },
        },
      },
      required: ['questions'],
    };

    const result = await this.aiService.fetchGeminiWithQuota(
      session.user_email,
      prompt,
      undefined,
      undefined,
      schema,
    );

    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error('Empty response from AI when generating questions');

    const parsed = JSON.parse(responseText);
    await this.aiService.logUsage(session.user_email, 'whatsapp_questions', result.usageMetadata, 'gemini');

    return parsed.questions || [];
  }

  async analyzeSession(sessionId: string) {
    const sb = this.supabaseService.getAdminClient();

    const { data: session } = await sb
      .from('whatsapp_verification_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session || session.status !== 'completed') return;

    const settings = await this.aiService.getSettings(session.user_email);
    const lang = session.preferred_language || 'ar';

    const { data: candidate } = await sb
      .from('candidates')
      .select('cv_text, name')
      .eq('id', session.candidate_id)
      .single();

    const { data: questions } = await sb
      .from('verification_questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_number', { ascending: true });

    const cvText = (candidate?.cv_text || '').slice(0, 3000);
    const qaText = questions?.map(q =>
      `Q${q.question_number}: ${q.question_text}\nA${q.question_number}: ${q.answer_text || '(no answer)'}\nResponse delay: ${q.response_delay_ms || 0}ms`
    ).join('\n\n') || '';

    const prompt = `You are an expert recruitment fraud analyst. Analyze this candidate's WhatsApp verification session to determine if their CV claims are genuine.

=== Candidate CV Summary ===
${cvText}

=== Verification Session ===
${qaText}

=== Analysis Instructions ===
Analyze for authenticity using these signals:

1. **Response Timing Analysis:**
   - Compare answer length (chars) vs response delay (seconds)
   - Flag if complex 200+ char answers arrive in <5 seconds (likely copy-paste)
   - Flag if all answers arrive at nearly identical times (scheduled/scripted)

2. **Linguistic Naturalness:**
   - Is the language conversational or formal/academic?
   - Does it sound like spoken language or written documentation?
   - Are there personal anecdotes ("I", "my team", "we built") or generic statements?

3. **CV Consistency:**
   - Do the details in answers match CV claims precisely?
   - Are years, tool names, project details consistent?
   - Does the candidate show depth beyond what's written in CV?

4. **Internet-Like Patterns:**
   - Does the answer read like a Wikipedia/Medium/GeeksforGeeks article?
   - Are there definition-style openings ("X is a framework that...")?
   - Is the vocabulary unnaturally precise or buzzword-heavy?

5. **Behavioral Signals:**
   - Did candidate give specific personal examples?
   - Was every answer too compliant and overly eager? (suspicious)

=== Output Format (JSON) ===
{
  "per_question_analysis": [
    {
      "question_number": 1,
      "naturalness_score": 0-100,
      "consistency_score": 0-100,
      "copy_paste_likelihood": 0-100,
      "ai_notes": "Brief analysis in ${lang === 'ar' ? 'Arabic' : 'English'}"
    }
  ],
  "overall_authenticity_score": 0-100,
  "verdict": "genuine|suspicious|likely_fabricated",
  "red_flags": [
    {"reason": "...", "severity": "high|medium|low"}
  ],
  "summary": "2-3 sentence executive summary in ${lang === 'ar' ? 'Arabic' : 'English'}"
}`;

    const schema = {
      type: 'object',
      properties: {
        per_question_analysis: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question_number: { type: 'integer' },
              naturalness_score: { type: 'integer' },
              consistency_score: { type: 'integer' },
              copy_paste_likelihood: { type: 'integer' },
              ai_notes: { type: 'string' },
            },
            required: ['question_number', 'naturalness_score', 'consistency_score', 'copy_paste_likelihood'],
          },
        },
        overall_authenticity_score: { type: 'integer' },
        verdict: { type: 'string', enum: ['genuine', 'suspicious', 'likely_fabricated'] },
        red_flags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              reason: { type: 'string' },
              severity: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
            required: ['reason', 'severity'],
          },
        },
        summary: { type: 'string' },
      },
      required: ['per_question_analysis', 'overall_authenticity_score', 'verdict', 'red_flags', 'summary'],
    };

    try {
      const result = await this.aiService.fetchGeminiWithQuota(
        session.user_email,
        prompt,
        undefined,
        undefined,
        schema,
      );

      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) throw new Error('Empty response from AI analysis');

      const analysis = JSON.parse(responseText);

      // Save per-question analysis
      for (const pq of (analysis.per_question_analysis || [])) {
        await sb.from('verification_questions')
          .update({
            naturalness_score: pq.naturalness_score,
            consistency_score: pq.consistency_score,
            copy_paste_likelihood: pq.copy_paste_likelihood,
            ai_notes: pq.ai_notes,
          })
          .eq('session_id', sessionId)
          .eq('question_number', pq.question_number);
      }

      // Save overall results
      await sb.from('whatsapp_verification_sessions')
        .update({
          authenticity_score: analysis.overall_authenticity_score,
          authenticity_verdict: analysis.verdict,
          red_flags: analysis.red_flags || [],
          summary: analysis.summary,
        })
        .eq('id', sessionId);

      await this.aiService.logUsage(session.user_email, 'whatsapp_analysis', result.usageMetadata, 'gemini');

      this.logger.log(`Analysis complete for session ${sessionId} — Score: ${analysis.overall_authenticity_score}, Verdict: ${analysis.verdict}`);
    } catch (error: any) {
      this.logger.error(`Analysis failed for session ${sessionId}: ${error.message}`);
    }
  }

  async getSession(userEmail: string, sessionId: string) {
    const sb = this.supabaseService.getAdminClient();
    const { data: session } = await sb
      .from('whatsapp_verification_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_email', userEmail)
      .single();

    if (!session) throw new Error('Session not found');

    const { data: questions } = await sb
      .from('verification_questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_number', { ascending: true });

    return { session, questions };
  }

  async getLatestForCandidate(userEmail: string, candidateId: string) {
    const sb = this.supabaseService.getAdminClient();
    const { data } = await sb
      .from('whatsapp_verification_sessions')
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    const { data: questions } = await sb
      .from('verification_questions')
      .select('*')
      .eq('session_id', data.id)
      .order('question_number', { ascending: true });

    return { session: data, questions };
  }

  async retrySession(userEmail: string, sessionId: string) {
    const sb = this.supabaseService.getAdminClient();
    const { data: session } = await sb
      .from('whatsapp_verification_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_email', userEmail)
      .single();

    if (!session) throw new Error('Session not found');

    // Delete old questions
    await sb.from('verification_questions').delete().eq('session_id', sessionId);

    // Reset session
    await sb.from('whatsapp_verification_sessions')
      .update({
        status: 'pending',
        current_question_index: 0,
        session_started_at: null,
        session_ended_at: null,
        authenticity_score: null,
        authenticity_verdict: null,
        red_flags: [],
        summary: null,
      })
      .eq('id', sessionId);

    // Re-start
    return this.startVerification(session.application_id, userEmail);
  }
}
