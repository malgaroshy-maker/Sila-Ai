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
  private readonly responseCache = new Map<
    string,
    { result: any; expiry: number }
  >();

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
      chatLanguage: settings.chat_language || 'BH',
      evaluationFocus: settings.evaluation_focus || 'balanced',
      maskPii: settings.mask_pii !== false,
      companyName: settings.company_name || 'SILA AI',
      webhookUrl: settings.webhook_url || '',
      exceptionalThreshold: parseInt(settings.exceptional_threshold) || 90,
      rejectThreshold: parseInt(settings.reject_threshold) || 50,
      duplicateStrategy: settings.duplicate_strategy || 'update',
      syncFrequency: settings.sync_frequency || '6h',
      whatsapp_enabled: settings.whatsapp_enabled || 'false',
      whatsapp_twilio_sid: settings.whatsapp_twilio_sid || '',
      whatsapp_twilio_token: settings.whatsapp_twilio_token || '',
      whatsapp_twilio_from: settings.whatsapp_twilio_from || '',
      whatsapp_question_count: settings.whatsapp_question_count || '4',
      whatsapp_timeout_minutes: settings.whatsapp_timeout_minutes || '3',
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
    responseSchema?: any,
    tools?: any[],
  ) {
    const contents =
      typeof promptOrContents === 'string'
        ? [{ parts: [{ text: promptOrContents }] }]
        : promptOrContents;

    const body: any = { contents };

    if (responseSchema) {
      body.generationConfig = {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      };
    }

    if (tools) {
      body.tools = tools;
    }

    if (fileBuffer && mimeType) {
      // Add file parts to the LAST content item (usually the current user prompt)
      const lastContent = body.contents[body.contents.length - 1];
      lastContent.parts.push({
        inlineData: {
          mimeType: mimeType,
          data: fileBuffer.toString('base64'),
        },
      });
    }

    const settings = await this.getSettings(userEmail);
    const fallbackModel = 'models/gemini-3.1-flash-lite-preview';

    // Pre-flight: check if primary model is blocked
    const { blocked: primaryBlocked } = await this.checkModelBlocked(
      settings.apiKey,
      settings.model,
    );

    const modelsToTry: string[] = [];
    if (!primaryBlocked) {
      modelsToTry.push(settings.model);
    } else {
      this.logger.warn(
        `Primary model ${settings.model} is blocked, skipping to fallback`,
      );
    }
    if (settings.model !== fallbackModel) {
      const { blocked: fallbackBlocked } = await this.checkModelBlocked(
        settings.apiKey,
        fallbackModel,
      );
      if (!fallbackBlocked) {
        modelsToTry.push(fallbackModel);
      } else {
        this.logger.warn(`Fallback model ${fallbackModel} is also blocked`);
      }
    }

    if (modelsToTry.length === 0) {
      throw Object.assign(
        new Error(
          `All models blocked. Primary: ${settings.model}, Fallback: ${fallbackModel}`,
        ),
        { status: 429 },
      );
    }

    let lastError: any;
    for (const model of modelsToTry) {
      try {
        return await this.executeGeminiCall(
          model,
          userEmail,
          settings,
          body,
          tools,
        );
      } catch (error: any) {
        lastError = error;
        if (error.status === 429) {
          this.logger.warn(
            `Model ${model} returned 429${modelsToTry.length > 1 ? ', trying next' : ''}`,
          );
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  private async executeGeminiCall(
    modelId: string,
    userEmail: string,
    settings: any,
    body: any,
    tools?: any[],
  ) {
    const baseUrl = `https://generativelanguage.googleapis.com/v1beta/${modelId.startsWith('models/') ? modelId : `models/${modelId}`}:generateContent?key=${settings.apiKey}`;

    // Phase 8.4: AI Context Caching
    const cacheKey = crypto
      .createHash('sha256')
      .update(JSON.stringify({ model: modelId, body, userEmail }))
      .digest('hex');

    const cached = this.responseCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      this.logger.log(`AI Cache Hit for ${userEmail} [${modelId}]`);
      return cached.result;
    }

    const bodyStr = JSON.stringify(body);
    this.logger.log(
      `Gemini request size for ${modelId}: ${(bodyStr.length / 1024 / 1024).toFixed(2)} MB`,
    );

    // Pre-flight: skip if model is blocked
    const { blocked, blockedUntil } = await this.checkModelBlocked(
      settings.apiKey,
      modelId,
    );
    if (blocked) {
      const blockedErr = new Error(
        `Model ${modelId} is blocked until ${blockedUntil}`,
      ) as any;
      blockedErr.status = 429;
      blockedErr.blockedUntil = blockedUntil;
      throw blockedErr;
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
    });

    await this.updateLiveQuota(settings.apiKey, modelId, response.headers);

    const responseText = await response.text();

    if (!response.ok) {
      this.logger.error(
        `Gemini API Error (Status ${response.status}): ${responseText}`,
      );
      // On 429, mark the model as blocked so subsequent calls skip it
      if (response.status === 429) {
        await this.markModelBlocked(settings.apiKey, modelId, responseText);
      }
      const apiErr = new Error(
        `AI Analysis failed (Status ${response.status}): ${responseText || 'No error message provided'}`,
      ) as any;
      apiErr.status = response.status;
      throw apiErr;
    }

    if (!responseText) {
      throw new Error('Empty response from AI API');
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      this.logger.error('Failed to parse Gemini response:', responseText);
      throw new Error('Failed to parse Gemini response as JSON');
    }

    this.responseCache.set(cacheKey, {
      result,
      expiry: Date.now() + 15 * 60 * 1000,
    });

    return result;
  }

  private async markModelBlocked(
    apiKey: string,
    modelId: string,
    errorBody: string,
  ) {
    let blockSeconds = 60; // Default 60s
    try {
      const parsed = JSON.parse(errorBody);
      const details = parsed?.error?.details || [];
      for (const detail of details) {
        if (
          detail?.['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' &&
          detail?.retryDelay
        ) {
          const delay = parseFloat(String(detail.retryDelay).replace('s', ''));
          if (!isNaN(delay) && delay > 0) {
            blockSeconds = delay + 2; // 2s safety buffer
          }
        }
      }
    } catch {
      // Use default
    }

    const blockedUntil = new Date(
      Date.now() + blockSeconds * 1000,
    ).toISOString();
    const hash = this.hashKey(apiKey);
    const sb = this.supabaseService.getClient();
    await sb.from('live_api_status').upsert(
      {
        api_key_hash: hash,
        model_id: modelId,
        is_blocked: true,
        blocked_until: blockedUntil,
        last_updated_at: new Date().toISOString(),
      },
      { onConflict: 'api_key_hash,model_id' },
    );
    this.logger.warn(
      `Model ${modelId} blocked until ${blockedUntil} (${blockSeconds}s)`,
    );
  }

  private async checkModelBlocked(apiKey: string, modelId: string) {
    const hash = this.hashKey(apiKey);
    const sb = this.supabaseService.getClient();
    const { data } = await sb
      .from('live_api_status')
      .select('is_blocked, blocked_until')
      .eq('api_key_hash', hash)
      .eq('model_id', modelId)
      .single();

    if (data?.is_blocked && data?.blocked_until) {
      const blockedUntil = new Date(data.blocked_until).getTime();
      if (Date.now() < blockedUntil) {
        return { blocked: true, blockedUntil: data.blocked_until };
      }
    }
    return { blocked: false, blockedUntil: null };
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

    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        skills_score: { type: 'integer' },
        gpa_score: { type: 'integer', nullable: true },
        language_score: { type: 'integer' },
        ind_readiness_score: { type: 'integer' },
        final_score: { type: 'integer' },
        is_fresh_graduate: { type: 'boolean' },
        project_impact_score: { type: 'integer' },
        cultural_fit_score: { type: 'integer' },
        career_trajectory: { type: 'string' },
        project_highlights: { type: 'array', items: { type: 'string' } },
        strengths: { type: 'array', items: { type: 'string' } },
        weaknesses: { type: 'array', items: { type: 'string' } },
        recommendation: { type: 'string', enum: ['Strong', 'Average', 'Weak'] },
        justification: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        flags: { type: 'array', items: { type: 'string' } },
        interview_questions: { type: 'array', items: { type: 'string' } },
        training_suggestions: { type: 'array', items: { type: 'string' } },
        design_score: { type: 'integer' },
        reasoning_trace: { type: 'string' },
      },
      required: [
        'name',
        'email',
        'skills_score',
        'language_score',
        'ind_readiness_score',
        'final_score',
        'is_fresh_graduate',
        'project_impact_score',
        'cultural_fit_score',
        'career_trajectory',
        'project_highlights',
        'strengths',
        'weaknesses',
        'recommendation',
        'justification',
        'tags',
        'flags',
        'interview_questions',
        'training_suggestions',
        'design_score',
        'reasoning_trace',
      ],
    };

    try {
      const result = await this.fetchGeminiWithQuota(
        userEmail,
        prompt,
        mimeType || 'application/pdf',
        cvBuffer,
        schema,
      );

      const candidateResponse =
        result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateResponse) throw new Error('Empty response from AI');

      // Native JSON Schema ensures the response is directly parseable
      const parsedData = JSON.parse(candidateResponse);

      // Log usage based on tokens returned in the raw JSON
      await this.logUsage(
        userEmail,
        'analysis',
        result.usageMetadata,
        settings.model,
      );

      return {
        data: parsedData,
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
      
      قم بتحليل السيرة الذاتية بدقة بناءً على المخطط (Schema) المطلوب.
      
      Additional Instructions:
      1. DESIGN & PRESENTATION (design_score): Evaluate the structural layout, hierarchy, and professionalism of the CV document visual presentation (0-100).
      2. REASONING TRACE (reasoning_trace): Provide a detailed step-by-step chain-of-thought explaining how you arrived at the final score, citing specific evidence from the CV and requirements.
      3. TRAP QUESTIONS: In your interview_questions, include 2-3 "trap questions" designed to verify the depth of the candidate's technical claims.
      
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
  ): Promise<{ name: string; email: string; phone: string; is_cv: boolean }> {
    const settings = await this.getSettings(userEmail);
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const prompt = `
      Today's Date: ${today}
      
      Extract the candidate's full name, email address, and phone number from this text.
      Also, determine if this document is actually a Professional CV/Resume for a job candidate.
      
      Text Content:
      ${cvText}
    `;

    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        is_cv: { type: 'boolean' },
      },
      required: ['name', 'email', 'is_cv'],
    };

    try {
      const result = await this.fetchGeminiWithQuota(
        userEmail,
        prompt,
        mimeType || 'application/pdf',
        cvBuffer,
        schema,
      );
      const parts = result.candidates?.[0]?.content?.parts;
      const responseText = parts?.[0]?.text || '{}';
      const parsed = JSON.parse(responseText);

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
        phone: parsed.phone || '',
        is_cv: parsed.is_cv === true,
      };
    } catch (error: any) {
      this.logger.error('Failed to extract candidate info:', error.message);
      return {
        name: 'Unknown',
        email: 'unknown@uploaded.cv',
        phone: '',
        is_cv: true,
      };
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
    `;

    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        requirements: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['title', 'description', 'requirements'],
    };

    try {
      const result = await this.fetchGeminiWithQuota(
        userEmail,
        prompt,
        undefined,
        undefined,
        schema,
      );
      const responseText =
        result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

      const parsed = JSON.parse(responseText);

      await this.logUsage(
        userEmail,
        'job_generation',
        result.usageMetadata,
        settings.model,
      );
      return parsed;
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
