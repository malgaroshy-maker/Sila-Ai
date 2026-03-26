import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SupabaseService } from '../supabase.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private async getSettings(userEmail: string) {
    const sb = this.supabaseService.getClient();
    const { data } = await sb.from('settings').select('*').eq('user_email', userEmail);
    const settings: any = {};
    data?.forEach(s => { settings[s.key] = s.value; });
    return {
      apiKey: settings.gemini_api_key || process.env.GEMINI_API_KEY || '',
      model: settings.gemini_model || 'gemini-1.5-flash',
      aiMode: settings.ai_mode || 'balanced',
      analysisLanguage: settings.analysis_language || 'BH',
      evaluationFocus: settings.evaluation_focus || 'balanced',
      maskPii: settings.mask_pii !== false
    };
  }

  async logUsage(userEmail: string, operation: string, usageMetadata: any) {
    if (!usageMetadata) return;
    const inputTokens = usageMetadata.promptTokenCount || 0;
    const outputTokens = usageMetadata.candidatesTokenCount || 0;
    const totalTokens = usageMetadata.totalTokenCount || 0;

    // gemini-2.0-flash pricing (approx): $0.10 / 1M input, $0.40 / 1M output
    const estCost = (inputTokens / 1_000_000) * 0.10 + (outputTokens / 1_000_000) * 0.40;

    try {
      const sb = this.supabaseService.getClient();
      await sb.from('ai_usage_logs').insert({
        user_email: userEmail,
        operation,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        est_cost: estCost
      });
    } catch (e) {
      this.logger.error('Failed to log AI usage', e);
    }
  }

  async analyzeCandidate(userEmail: string, jobParams: any, cvText: string, cvBuffer?: Buffer, mimeType?: string): Promise<any> {
    const settings = await this.getSettings(userEmail);
    const genAI = new GoogleGenerativeAI(settings.apiKey);
    const model = genAI.getGenerativeModel({ model: settings.model });
    
    const prompt = `
      أنت مساعد HR خبير وتقوم بمقارنة السيرة الذاتية للمرشح مع متطلبات الوظيفة.
      
      متطلبات الوظيفة:
      ${JSON.stringify(jobParams)}
      
      نص السيرة الذاتية:
      ${cvText}
      
      قم بتحليل السيرة الذاتية وإرجاع مخرجات JSON صارمة بالتنسيق التالي بدون أي نص إضافي:
      {
        "skills_score": 0,
        "gpa_score": null,
        "language_score": 0,
        "ind_readiness_score": 0,
        "final_score": 0,
        "is_fresh_graduate": false,
        "project_impact_score": 0,
        "cultural_fit_score": 0,
        "career_trajectory": "تحليل مسار المرشح المهني وتوجهه المستقبلي",
        "project_highlights": ["أبرز مشروع أو إنجاز 1", "إنجاز 2"],
        "strengths": ["نقطة قوة 1"],
        "weaknesses": ["نقطة ضعف 1"],
        "recommendation": "Strong|Average|Weak",
        "justification": "مبرر التقييم باختصار مع ذكر الملاءمة الثقافية والتوقعات",
        "tags": ["Senior", "Junior", "🎓 Fresh Grad", "Full-Stack"],
        "flags": ["🚩 Gap Detected", "🚩 Missing Tool"],
        "interview_questions": ["سؤال مقابلة مخصص 1 (ركز على المشاريع للخريجين الجدد)", "سؤال 2", "سؤال 3"],
        "training_suggestions": ["اقتراح لسد الفجوة بين الأكاديميا والصناعة (خاصة للخريجين)", "اقتراح 2"]
      }

      تعليمات مهمة:
      - is_fresh_graduate: true إذا كان المرشح طالباً حالياً أو تخرج مؤخراً (خلال سنتين) وليس لديه خبرة مهنية كبيرة.
      - project_impact_score: للخريجين الجدد، قم بتقييم مشاريعهم الجامعية كبديل لسنوات الخبرة (0-100). للمحترفين، استخدم 0.
      - cultural_fit_score: مدى ملاءمة شخصية ومهارات المرشح لبيئة العمل (0-100).
      - career_trajectory: وصف قصير لمسار نمو المرشح المتوقع.
      - project_highlights: قائمة بأهم 2-3 مشاريع أو إنجازات تقنية/أكاديمية.
      - skills_score, language_score, ind_readiness_score, final_score: أرقام من 0 إلى 100.
      - gpa_score: المعدل التراكمي من 100 إذا وجد، وإلا null.
      - tags: مصفوفة تشمل "🎓 Fresh Grad" إذا كان خريجاً جديداً، بالإضافة لمهاراته الأساسية.
      - flags: مصفوفة تنبيهات مثل "🚩 Gap Detected", "🚩 Job Hopper", "🚩 Missing Tool", "🚩 Overqualified".
      - interview_questions: 3 أسئلة، ركز في حالة الخريجين على مشاريعهم وقدرتهم على التعلم.
      - training_suggestions: ركز على سد الفجوة المهنية للخريجين (Industry-Bridge).
      
      ${settings.aiMode === 'strict' 
        ? 'STRICT MODE ACTIVE: You must heavily penalize any missing skills or requirements. Do NOT give partial credit. If exact requirements are not met, the ind_readiness_score and final_score MUST be very low.' 
        : 'BALANCED MODE ACTIVE: Evaluate the candidate comprehensively. Gracefully handle partial matches and transferable skills.'}

      ${settings.evaluationFocus === 'technical' 
        ? 'EVALUATION FOCUS: PRIORITIZE TECHNICAL SKILLS. Highly value specific tools, frameworks, and hard-skills listed in the requirements.' 
        : settings.evaluationFocus === 'career'
        ? 'EVALUATION FOCUS: PRIORITIZE CAREER & LEADERSHIP. Highly value years of experience, leadership roles, and professional career progression.'
        : 'EVALUATION FOCUS: BALANCED. Value both technical mastery and professional experience equally.'}

      ${settings.analysisLanguage === 'EN' 
        ? 'LANGUAGE: Response MUST be in professional English. All textual fields (justification, strengths, weaknesses, recommendation, questions) should be exclusively in English.' 
        : settings.analysisLanguage === 'AR'
        ? 'LANGUAGE: Response MUST be in professional Arabic. All textual fields (justification, strengths, weaknesses, recommendation, questions) should be exclusively in Arabic.'
        : 'LANGUAGE: BILINGUAL MODE. For the "justification" field, provide a professional paragraph in English followed by a high-quality Arabic translation of the same points. For other text fields, use English as the primary language but match the candidate\'s CV language if it is primarily Arabic.'}

      ${settings.maskPii 
        ? 'PRIVACY: Mask PII. Do NOT include phone numbers, email addresses, or specific home addresses in the textual justification or summaries. Use placeholders like [PHONE] or [ADDRESS] if necessary.' 
        : ''}
    `;

    try {
      let result;
      if (cvBuffer) {
        result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: cvBuffer.toString('base64'),
              mimeType: mimeType || 'application/pdf'
            }
          }
        ]);
      } else {
        result = await model.generateContent(prompt);
      }
      
      const responseText = result.response.text();
      const cleanedJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      // Log usage
      await this.logUsage(userEmail, 'analysis', result.response.usageMetadata);
      
      return JSON.parse(cleanedJson);
    } catch (error: any) {
      console.error('AI Analysis failed:', error);
      throw new InternalServerErrorException(`AI Error: ${error.message}`);
    }
  }

  /**
   * Extract candidate name and email from CV text using AI.
   */
  async extractCandidateInfo(userEmail: string, cvText: string, cvBuffer?: Buffer, mimeType?: string): Promise<{ name: string; email: string; is_cv: boolean }> {
    const settings = await this.getSettings(userEmail);
    const genAI = new GoogleGenerativeAI(settings.apiKey);
    const model = genAI.getGenerativeModel({ model: settings.model });

    const prompt = `
      Extract the candidate's full name and email address from this text.
      Also, determine if this document is actually a Professional CV/Resume for a job candidate.

      Return ONLY a JSON object with no extra text:
      { 
        "name": "Full Name", 
        "email": "email@example.com",
        "is_cv": true 
      }
      
      CRITICAL INSTRUCTIONS:
      - If the document is an image that doesn't contain a clear CV (like a logo, icon, or personal photo), set "is_cv": false.
      - If it is just a short cover letter, interview invitation, or company document, set "is_cv": false.
      - Default to "is_cv": true only if it is clearly a professional profile or resume.
      - If the name or email is not found, use "Unknown" for name and "unknown@uploaded.cv" for email.
      
      Text Content:
      ${cvText}
    `;

    try {
      let result;
      if (cvBuffer) {
        result = await model.generateContent([
          prompt,
          { inlineData: { data: cvBuffer.toString('base64'), mimeType: mimeType || 'application/pdf' } }
        ]);
      } else {
        result = await model.generateContent(prompt);
      }

      const responseText = result.response.text();
      const cleanedJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedJson);
      
      // Log usage
      await this.logUsage(userEmail, 'info_extraction', result.response.usageMetadata);
      
      // Safety check: ensure name and email are never null or empty strings
      return {
        name: parsed.name && parsed.name.trim() !== '' ? parsed.name : 'Unknown',
        email: parsed.email && parsed.email.trim() !== '' ? parsed.email : 'unknown@uploaded.cv',
        is_cv: parsed.is_cv === true
      };
    } catch (error: any) {
      this.logger.error('Failed to extract candidate info:', error.message);
      return { name: 'Unknown', email: 'unknown@uploaded.cv', is_cv: true }; // Default to true on error to avoid false positives
    }
  }

  /**
   * Extract text from a document using Gemini's multimodal capabilities.
   */
  async extractTextFromDocument(userEmail: string, buffer: Buffer, mimeType: string): Promise<string | null> {
    try {
      const settings = await this.getSettings(userEmail);
      const genAI = new GoogleGenerativeAI(settings.apiKey);
      const model = genAI.getGenerativeModel({ model: settings.model });

      const result = await model.generateContent([
        'Extract ALL text from this document. Return ONLY the raw text content, no formatting or commentary.',
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: mimeType
          }
        }
      ]);

      await this.logUsage(userEmail, 'ocr', result.response.usageMetadata);

      return result.response.text() || null;
    } catch (error: any) {
      console.error(`OCR extraction failed for ${mimeType}:`, error.message);
      return null;
    }
  }

  /**
   * Generate a structured job description from natural language.
   */
  async generateJobFromText(userEmail: string, userInput: string): Promise<{ title: string; description: string; requirements: string[] }> {
    const settings = await this.getSettings(userEmail);
    const genAI = new GoogleGenerativeAI(settings.apiKey);
    const model = genAI.getGenerativeModel({ model: settings.model });

    const prompt = `You are an HR expert. Convert this natural language job request into a structured job posting.

User request: "${userInput}"

Return ONLY valid JSON with no extra text:
{
  "title": "Job Title",
  "description": "Detailed job description (2-3 sentences)",
  "requirements": ["requirement 1", "requirement 2", "requirement 3"]
}

Keep it professional and relevant. Include at least 3 requirements.`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      
      await this.logUsage(userEmail, 'job_generation', result.response.usageMetadata);
      
      return JSON.parse(text);
    } catch (error: any) {
      this.logger.error('Job generation failed:', error.message);
      return { title: userInput, description: userInput, requirements: [userInput] };
    }
  }

  async generateEmbedding(userEmail: string, text: string): Promise<number[]> {
    const settings = await this.getSettings(userEmail);
    const genAI = new GoogleGenerativeAI(settings.apiKey);
    // Use gemini-embedding-2-preview which is available and supports custom dimensions
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-2-preview' });
    
    try {
      // Specify outputDimensionality to match our 768-dimension pgvector schema
      const result = await (model as any).embedContent({
        content: { role: 'user', parts: [{ text }] },
        outputDimensionality: 768
      });
      return result.embedding.values;
    } catch (error: any) {
      this.logger.error('Embedding generation failed:', error.message);
      throw new InternalServerErrorException(`Embedding Error: ${error.message}`);
    }
  }
}
