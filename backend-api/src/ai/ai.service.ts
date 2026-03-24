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
      aiMode: settings.ai_mode || 'balanced'
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
        "strengths": ["نقاط القوة"],
        "weaknesses": ["نقاط الضعف"],
        "recommendation": "Strong|Average|Weak",
        "justification": "مبرر التقييم باختصار",
        "tags": ["Senior", "Full-Stack"],
        "flags": [],
        "interview_questions": ["سؤال مقابلة مخصص 1", "سؤال 2", "سؤال 3"],
        "training_suggestions": ["اقتراح تدريبي 1"]
      }

      تعليمات مهمة:
      - skills_score, language_score, ind_readiness_score, final_score: أرقام من 0 إلى 100
      - gpa_score: إذا كان المعدل التراكمي (GPA) مذكور في السيرة الذاتية، أدخل الدرجة من 100. إذا لم يُذكر المعدل التراكمي، اجعل القيمة null
      - strengths و weaknesses: قوائم نصية
      - recommendation: "Strong" أو "Average" أو "Weak"
      - tags: مصفوفة من التصنيفات التلقائية مثل "Senior", "Junior", "Full-Stack", "Backend", "Frontend", "Fresh Graduate", "Manager" إلخ
      - flags: مصفوفة من التنبيهات مثل "Weak CV" (سيرة ذاتية ضعيفة), "Overqualified" (مؤهل أكثر من اللازم), "Missing Key Skills" (مهارات أساسية مفقودة). اتركها فارغة [] إذا لم يكن هناك تنبيهات
      - interview_questions: 3 أسئلة مقابلة مخصصة بناءً على السيرة الذاتية والوظيفة
      - training_suggestions: اقتراحات تدريبية لتحسين المرشح. اتركها فارغة [] إذا كان المرشح قوياً
      
      ${settings.aiMode === 'strict' 
        ? 'STRICT MODE ACTIVE: You must heavily penalize any missing skills or requirements. Do NOT give partial credit. If exact requirements are not met, the ind_readiness_score and final_score MUST be very low.' 
        : 'BALANCED MODE ACTIVE: Evaluate the candidate comprehensively. Gracefully handle partial matches and transferable skills.'}
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
  async extractCandidateInfo(userEmail: string, cvText: string, cvBuffer?: Buffer, mimeType?: string): Promise<{ name: string; email: string }> {
    const settings = await this.getSettings(userEmail);
    const genAI = new GoogleGenerativeAI(settings.apiKey);
    const model = genAI.getGenerativeModel({ model: settings.model });

    const prompt = `
      Extract the candidate's full name and email address from this CV/resume text.
      Return ONLY a JSON object with no extra text:
      { "name": "Full Name", "email": "email@example.com" }
      
      If the name or email is not found, use "Unknown" for name and "unknown@uploaded.cv" for email.
      
      CV Text:
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
        email: parsed.email && parsed.email.trim() !== '' ? parsed.email : 'unknown@uploaded.cv'
      };
    } catch (error: any) {
      this.logger.error('Failed to extract candidate info:', error.message);
      return { name: 'Unknown', email: 'unknown@uploaded.cv' };
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
