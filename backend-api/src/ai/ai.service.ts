import {
  Injectable,
  InternalServerErrorException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SupabaseService } from '../supabase.service';
import * as crypto from 'crypto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private hashKey(key: string): string {
    if (!key) return 'anonymous';
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Helper to get user's Gemini settings (API Key and chosen Model).
   * Defaults to Gemini 3.1 Flash Lite (March 2026 standard) if not configured.
   */
  public async getSettings(userEmail: string) {
    const sb = this.supabaseService.getClient();
    const { data } = await sb
      .from('settings')
      .select('*')
      .eq('user_email', userEmail);
    const settings: any = {};
    data?.forEach((s) => {
      settings[s.key] = s.value;
    });

    // Default to gemini-3.1-flash-lite-preview for 2026 standards
    return {
      apiKey: settings.gemini_api_key || process.env.GEMINI_API_KEY || '',
      model: settings.gemini_model || 'models/gemini-3.1-flash-lite-preview',
      aiMode: settings.ai_mode || 'balanced',
      analysisLanguage: settings.analysis_language || 'BH',
      evaluationFocus: settings.evaluation_focus || 'balanced',
      maskPii: settings.mask_pii !== false,
    };
  }

  /**
   * Fetches the curated model list from Supabase.
   * Filters for models that support text generation (chat/analysis).
   */
  async getModelCatalog() {
    const sb = this.supabaseService.getClient();
    const { data, error } = await sb
      .from('gemini_models')
      .select('*')
      .eq('is_active', true)
      .contains('task_type', ['generateContent']) // Only models that support generation
      .order('display_name', { ascending: true });

    if (error)
      throw new InternalServerErrorException('Failed to fetch model catalog');
    return data;
  }

  /**
   * Get quota limits for a specific model.
   */
  async getModelQuota(modelId: string) {
    const sb = this.supabaseService.getClient();
    const { data } = await sb
      .from('gemini_models')
      .select('rpm_limit, tpm_limit, rpd_limit, display_name')
      .eq('model_id', modelId)
      .single();

    return (
      data || {
        rpm_limit: 15,
        tpm_limit: 1000000,
        rpd_limit: 1500,
        display_name: modelId.split('/').pop() || modelId,
      }
    );
  }

  async logUsage(
    userEmail: string,
    operation: string,
    usageMetadata: any,
    modelName: string,
  ) {
    if (!usageMetadata) return;
    const inputTokens = usageMetadata.promptTokenCount || 0;
    const outputTokens = usageMetadata.candidatesTokenCount || 0;
    const totalTokens = usageMetadata.totalTokenCount || 0;

    // Pricing (approx): $0.10 / 1M input, $0.40 / 1M output (average across models)
    const estCost =
      (inputTokens / 1_000_000) * 0.1 + (outputTokens / 1_000_000) * 0.4;

    try {
      const sb = this.supabaseService.getClient();
      await sb.from('ai_usage_logs').insert({
        user_email: userEmail,
        operation,
        model_name: modelName,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        est_cost: estCost,
      });
    } catch (e) {
      this.logger.error('Failed to log AI usage', e);
    }
  }

  /**
   * UPDATED: Intercepts headers and updates live quota status in Supabase.
   */
  private async updateLiveQuota(
    apiKey: string,
    modelId: string,
    headers: Headers,
  ) {
    const hash = this.hashKey(apiKey);
    const remaining = headers.get('x-ratelimit-remaining-requests');
    const limit = headers.get('x-ratelimit-limit-requests');
    const reset = headers.get('x-ratelimit-reset-requests');

    if (!remaining && !limit) return; // No headers found

    const sb = this.supabaseService.getClient();
    await sb.from('live_api_status').upsert(
      {
        api_key_hash: hash,
        model_id: modelId,
        last_seen_remaining: remaining ? parseInt(remaining) : null,
        total_limit: limit ? parseInt(limit) : null,
        is_blocked: false, // Reset blocked status if we have a successful remaining count
        reset_at: reset ? new Date(reset).toISOString() : null,
        last_updated_at: new Date().toISOString(),
      },
      { onConflict: 'api_key_hash,model_id' },
    );
  }

  /**
   * Advanced Workaround: Native fetch to capture headers.
   */
  async fetchGeminiWithQuota(
    userEmail: string,
    promptOrContents: string | any[],
    mimeType?: string,
    fileBuffer?: Buffer,
  ) {
    const settings = await this.getSettings(userEmail);
    const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model.replace('models/', '')}:generateContent?key=${settings.apiKey}`;

    const contents =
      typeof promptOrContents === 'string'
        ? [{ parts: [{ text: promptOrContents }] }]
        : promptOrContents;

    const body: any = { contents };

    if (fileBuffer && mimeType) {
      // Add file parts to the LAST content item (usually the current user prompt)
      const lastContent = body.contents[body.contents.length - 1];
      lastContent.parts.push({
        inline_data: {
          mime_type: mimeType,
          data: fileBuffer.toString('base64'),
        },
      });
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Capture Headers
    await this.updateLiveQuota(
      settings.apiKey,
      settings.model,
      response.headers,
    );

    const result = await response.json();
    if (!response.ok) {
      if (response.status === 429) {
        await this.supabaseService
          .getClient()
          .from('live_api_status')
          .upsert({
            api_key_hash: this.hashKey(settings.apiKey),
            model_id: settings.model,
            is_blocked: true,
            last_updated_at: new Date().toISOString(),
          });

        throw new HttpException(
          {
            message:
              'AI Quota Exceeded. Please try a lighter model or check your API key billings.',
            code: 'AI_QUOTA_EXCEEDED',
            model: settings.model,
            retryAfter: response.headers.get('retry-after') || '30s',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new HttpException(
        {
          message: `AI Analysis failed: ${result?.error?.message || 'Unknown AI Error'}`,
          code: 'AI_ERROR',
          details: result?.error,
        },
        response.status,
      );
    }

    return result;
  }

  /**
   * Fetches the latest live quota from our cache (populated by fetch headers).
   */
  async getLiveQuota(apiKey: string, modelId: string) {
    const hash = this.hashKey(apiKey);
    const sb = this.supabaseService.getClient();
    const { data } = await sb
      .from('live_api_status')
      .select('*')
      .eq('api_key_hash', hash)
      .eq('model_id', modelId)
      .single();
    return data;
  }

  async analyzeCandidate(
    userEmail: string,
    jobParams: any,
    cvText: string,
    cvBuffer?: Buffer,
    mimeType?: string,
  ): Promise<any> {
    const settings = await this.getSettings(userEmail);
    const prompt = this.constructAnalyzePrompt(jobParams, cvText, settings);

    try {
      const result = await this.fetchGeminiWithQuota(
        userEmail,
        prompt,
        mimeType || 'application/pdf',
        cvBuffer,
      );

      const candidateResponse =
        result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateResponse) throw new Error('Empty response from AI');

      const cleanedJson = candidateResponse
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      // Log usage based on tokens returned in the raw JSON
      await this.logUsage(
        userEmail,
        'analysis',
        result.usageMetadata,
        settings.model,
      );

      return {
        data: JSON.parse(cleanedJson),
        metadata: {
          usage: result.usageMetadata,
          model: settings.model,
        },
      };
    } catch (error: any) {
      this.logger.error(`AI Analysis failed: ${error.message}`);
      throw new InternalServerErrorException(`AI Error: ${error.message}`);
    }
  }

  private constructAnalyzePrompt(
    jobParams: any,
    cvText: string,
    settings: any,
  ): string {
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

    return `
      Today's Date: ${today} (اليوم هو: ${todayAr})
      
      أنت مساعد HR خبير وتقوم بمقارنة السيرة الذاتية للمرشح مع متطلبات الوظيفة.
      
      متطلبات الوظيفة:
      ${JSON.stringify(jobParams)}
      
      نص السيرة الذاتية:
      ${cvText}
      
      قم بتحليل السيرة الذاتية وإرجاع مخرجات JSON صارمة بالتنسيق التالي بدون أي نص إضافي:
      {
        "name": "اسم المرشح الكامل",
        "email": "البريد الإلكتروني",
        "phone": "رقم الهاتف",
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

      ${
        settings.aiMode === 'strict'
          ? 'STRICT MODE ACTIVE: You must heavily penalize any missing skills or requirements. Do NOT give partial credit.'
          : 'BALANCED MODE ACTIVE: Evaluate the candidate comprehensively.'
      }

      ${
        settings.evaluationFocus === 'technical'
          ? 'EVALUATION FOCUS: PRIORITIZE TECHNICAL SKILLS.'
          : settings.evaluationFocus === 'career'
            ? 'EVALUATION FOCUS: PRIORITIZE CAREER & LEADERSHIP.'
            : 'EVALUATION FOCUS: BALANCED.'
      }

      ${
        settings.analysisLanguage === 'EN'
          ? 'LANGUAGE: Response MUST be in professional English.'
          : settings.analysisLanguage === 'AR'
            ? 'LANGUAGE: Response MUST be in professional Arabic.'
            : 'LANGUAGE: BILINGUAL MODE.'
      }
    `;
  }

  /**
   * Extract candidate name and email from CV text using AI.
   */
  async extractCandidateInfo(
    userEmail: string,
    cvText: string,
    cvBuffer?: Buffer,
    mimeType?: string,
  ): Promise<{ name: string; email: string; is_cv: boolean }> {
    const settings = await this.getSettings(userEmail);
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const prompt = `
      Today's Date: ${today}
      
      Extract the candidate's full name and email address from this text.
      Also, determine if this document is actually a Professional CV/Resume for a job candidate.

      Return ONLY a JSON object with no extra text:
      { 
        "name": "Full Name", 
        "email": "email@example.com",
        "is_cv": true 
      }
      
      Text Content:
      ${cvText}
    `;

    try {
      const result = await this.fetchGeminiWithQuota(
        userEmail,
        prompt,
        mimeType || 'application/pdf',
        cvBuffer,
      );
      const parts = result.candidates?.[0]?.content?.parts;
      const responseText = parts?.[0]?.text || '{}';
      const cleanedJson = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleanedJson);

      await this.logUsage(
        userEmail,
        'info_extraction',
        result.usageMetadata,
        settings.model,
      );

      return {
        name:
          parsed.name && parsed.name.trim() !== '' ? parsed.name : 'Unknown',
        email:
          parsed.email && parsed.email.trim() !== ''
            ? parsed.email
            : 'unknown@uploaded.cv',
        is_cv: parsed.is_cv === true,
      };
    } catch (error: any) {
      this.logger.error('Failed to extract candidate info:', error.message);
      return { name: 'Unknown', email: 'unknown@uploaded.cv', is_cv: true };
    }
  }

  /**
   * Extract text from a document using Gemini's multimodal capabilities.
   */
  async extractTextFromDocument(
    userEmail: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string | null> {
    try {
      const settings = await this.getSettings(userEmail);
      const prompt =
        'Extract ALL text from this document. Return ONLY the raw text content, no formatting or commentary.';

      const result = await this.fetchGeminiWithQuota(
        userEmail,
        prompt,
        mimeType,
        buffer,
      );
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

      await this.logUsage(
        userEmail,
        'ocr',
        result.usageMetadata,
        settings.model,
      );
      return text || null;
    } catch (error: any) {
      this.logger.error(
        `OCR extraction failed for ${mimeType}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Generate a structured job description from natural language.
   */
  async generateJobFromText(
    userEmail: string,
    userInput: string,
  ): Promise<{ title: string; description: string; requirements: string[] }> {
    const settings = await this.getSettings(userEmail);
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const prompt = `
      Today's Date: ${today}
      
      You are an HR expert. Convert this natural language job request into a structured job posting.
      User request: "${userInput}"
      Return ONLY valid JSON:
      {
        "title": "Job Title",
        "description": "Detailed job description",
        "requirements": ["req 1", "req 2"]
      }`;

    try {
      const result = await this.fetchGeminiWithQuota(userEmail, prompt);
      const responseText =
        result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const text = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      await this.logUsage(
        userEmail,
        'job_generation',
        result.usageMetadata,
        settings.model,
      );
      return JSON.parse(text);
    } catch (error: any) {
      this.logger.error('Job generation failed:', error.message);
      return {
        title: userInput,
        description: userInput,
        requirements: [userInput],
      };
    }
  }

  async generateEmbedding(userEmail: string, text: string): Promise<number[]> {
    const settings = await this.getSettings(userEmail);
    const genAI = new GoogleGenerativeAI(settings.apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-embedding-2-preview',
    });

    try {
      const result = await (model as any).embedContent({
        content: { role: 'user', parts: [{ text }] },
        outputDimensionality: 768,
      });
      return result.embedding.values;
    } catch (error: any) {
      this.logger.error('Embedding generation failed:', error.message);
      throw new InternalServerErrorException(
        `Embedding Error: ${error.message}`,
      );
    }
  }
}
