import { Injectable, InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import { AiService } from '../ai/ai.service';
import { WebhooksService } from './webhooks.service';

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    private supabaseService: SupabaseService,
    private aiService: AiService,
    private webhooksService: WebhooksService,
  ) {}

  /**
   * Step 1: Ingest a CV — parse the PDF, store the candidate. No job analysis yet.
   * Returns the candidate record with cv_text.
   */
  async ingestCandidate(userEmail: string, name: string, email: string, file: Express.Multer.File) {
    const sb = this.supabaseService.getClient();

    // 1. Parse PDF buffer to text
    let cvText = '';
    let cvBuffer: Buffer | undefined = undefined;

    if (!file || !file.buffer) {
      this.logger.warn('ingestCandidate called with missing file or buffer');
      cvText = '[Missing CV Content]';
    } else if (file.mimetype === 'text/plain') {
      cvText = file.buffer.toString('utf8');
    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        cvText = result.value;
      } catch (e: any) {
        this.logger.error(`DOCX parsing error: ${e.message}`);
        cvText = '[Unreadable DOCX content]';
      }
    } else if (file.mimetype.startsWith('image/')) {
      try {
        this.logger.log(`Using Gemini OCR for image type: ${file.mimetype}`);
        cvBuffer = file.buffer;
        const ocrText = await this.aiService.extractTextFromDocument(userEmail, file.buffer, file.mimetype);
        cvText = ocrText || `[Image CV - Could not extract text]`;
      } catch (e: any) {
        this.logger.error(`Image OCR parsing error: ${e.message}`);
        cvText = '[Image CV - OCR failed]';
      }
    } else {
      try {
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
        const pdfData = await parser.getText();
        cvText = pdfData.text || '';
        await parser.destroy();

        if (cvText.trim().length < 100 && file.mimetype === 'application/pdf') {
          this.logger.log('PDF text too short, using Gemini multimodal OCR fallback');
          cvBuffer = file.buffer;
          // Use AI to extract text from the scanned PDF
          const ocrText = await this.aiService.extractTextFromDocument(userEmail, cvBuffer, 'application/pdf');
          if (ocrText) cvText = ocrText;
        }
      } catch (e: any) {
        this.logger.warn(`PDF parsing error: ${e.message}`);
        if (file.mimetype === 'application/pdf' && file.buffer) {
          cvBuffer = file.buffer;
          // Use AI to extract text from the scanned PDF
          try {
            const ocrText = await this.aiService.extractTextFromDocument(userEmail, file.buffer, 'application/pdf');
            cvText = ocrText || '[Scanned PDF - Could not extract text]';
          } catch {
            cvText = '[Scanned PDF - Could not extract text]';
          }
        } else {
          cvText = '[Unreadable binary content]';
        }
      }
    }
    
    // 1.5 Extract candidate name and email from CV text using AI for better accuracy
    let finalName = name;
    let finalEmail = email;
    
    try {
      this.logger.log(`Extracting candidate info from CV text for ${email}...`);
      const extracted = await this.aiService.extractCandidateInfo(userEmail, cvText, cvBuffer, file.mimetype);
      
      // Only override if AI found something plausible (not "Unknown" or the default placeholder)
      if (extracted.name && extracted.name !== 'Unknown') {
        finalName = extracted.name;
      }
      if (extracted.email && extracted.email !== 'unknown@uploaded.cv' && extracted.email.includes('@')) {
        finalEmail = extracted.email;
      }
      
      this.logger.log(`Extraction result: ${finalName} <${finalEmail}> (Original: ${name} <${email}>)`);
    } catch (e: any) {
      this.logger.warn(`Candidate info extraction failed: ${e.message}. Using provided info.`);
    }

    // 2. Upsert Candidate record
    const { data: candidate, error: candError } = await sb
      .from('candidates')
      .upsert({ 
        name: finalName, 
        email: finalEmail, 
        cv_text: cvText, 
        user_email: userEmail 
      }, { onConflict: 'user_email, email' })
      .select()
      .single();

    if (candError) throw new InternalServerErrorException(candError.message);

    // 3. Generate and store embedding for RAG
    try {
      if (cvText && cvText.trim().length > 10) {
        this.logger.log(`Generating embedding for candidate: ${email}...`);
        const embedding = await this.aiService.generateEmbedding(userEmail, cvText);
        const { error: embedError } = await sb.from('candidate_embeddings').upsert({
          candidate_id: candidate.id,
          content: cvText, // Storing full text for RAG retrieval
          embedding: embedding,
          user_email: userEmail
        }, { onConflict: 'candidate_id' });
        
        if (embedError) this.logger.error(`Embedding storage error: ${embedError.message}`);
      }
    } catch (e: any) {
      this.logger.error(`Embedding process failed for ${email}: ${e.message}`);
    }

    this.logger.log(`Ingested candidate: ${name} (${email}), CV length: ${cvText.length} chars`);
    return candidate;
  }

  /**
   * Step 2: Analyze a candidate against ALL existing jobs for the user.
   * Skips jobs that already have an analysis for this candidate.
   */
  async analyzeForAllJobs(userEmail: string, candidate: { id: string; name: string; email: string; cv_text: string }, skipNotifications = false) {
    const sb = this.supabaseService.getClient();

    // Fetch all jobs
    const { data: jobs, error: jobsError } = await sb
      .from('jobs')
      .select('*')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false });

    if (jobsError || !jobs || jobs.length === 0) {
      this.logger.warn('No jobs found to analyze candidate against');
      return [];
    }

    this.logger.log(`Analyzing candidate ${candidate.name} against ${jobs.length} job(s)...`);

    const results = [];
    for (const job of jobs) {
      try {
        const result = await this.analyzeForJob(userEmail, candidate, job);
        if (result && !result.skipped) {
          // Trigger webhook if score is high and notifications are not skipped
          if (!skipNotifications) {
            this.webhooksService.checkAndNotify(userEmail, candidate.name, result.analysis.final_score, job.title);
          }
          results.push(result);
        } else if (result) {
          results.push(result);
        }
      } catch (err: any) {
        this.logger.error(`Error analyzing candidate ${candidate.name} for job ${job.title}: ${err.message}`);
      }
    }

    return results;
  }

  /**
   * Analyze a single candidate against a single job.
   * Skips if analysis already exists.
   */
  async analyzeForJob(
    userEmail: string,
    candidate: { id: string; name: string; email: string; cv_text: string },
    job: { id: string; title: string; description: string; requirements: any }
  ) {
    const sb = this.supabaseService.getClient();

    // Check if analysis already exists
    const { data: existingApp } = await sb
      .from('applications')
      .select('id, analysis_results(*)')
      .eq('candidate_id', candidate.id)
      .eq('job_id', job.id)
      .single();

    if (existingApp?.analysis_results) {
      this.logger.debug(`Skipping: ${candidate.name} already analyzed for "${job.title}"`);
      return { candidate, application: existingApp, analysis: existingApp.analysis_results, skipped: true };
    }

    // Analyze CV using AI
    this.logger.log(`AI analyzing: ${candidate.name} → "${job.title}" for user ${userEmail}`);
    const analysisResult = await this.aiService.analyzeCandidate(
      userEmail,
      { title: job.title, description: job.description, requirements: job.requirements },
      candidate.cv_text
    );

    // Create Application record
    const { data: application, error: appError } = await sb
      .from('applications')
      .upsert(
        { job_id: job.id, candidate_id: candidate.id, status: 'analyzed' },
        { onConflict: 'job_id, candidate_id' }
      )
      .select()
      .single();

    if (appError) throw new InternalServerErrorException(appError.message);

    // Store AI Analysis results
    const { data: results, error: resError } = await sb
      .from('analysis_results')
      .upsert({
        application_id: application.id,
        skills_score: analysisResult.skills_score,
        gpa_score: analysisResult.gpa_score,
        language_score: analysisResult.language_score,
        ind_readiness_score: analysisResult.ind_readiness_score,
        final_score: analysisResult.final_score,
        strengths: analysisResult.strengths,
        weaknesses: analysisResult.weaknesses,
        recommendation: analysisResult.recommendation,
        justification: analysisResult.justification,
        tags: analysisResult.tags || [],
        flags: analysisResult.flags || [],
        interview_questions: analysisResult.interview_questions || [],
        training_suggestions: analysisResult.training_suggestions || []
      }, { onConflict: 'application_id' })
      .select()
      .single();

    if (resError) throw new InternalServerErrorException(resError.message);

    return { candidate, application, analysis: results, skipped: false };
  }

  /**
   * Legacy method for the upload controller — ingests + analyzes against one job.
   */
  async processCandidate(userEmail: string, jobId: string, name: string, email: string, file: Express.Multer.File) {
    const candidate = await this.ingestCandidate(userEmail, name, email, file);

    const { data: job, error: jobError } = await this.supabaseService
      .getClient()
      .from('jobs')
      .select('*')
      .eq('user_email', userEmail)
      .eq('id', jobId)
      .single();

    if (jobError || !job) throw new NotFoundException('Job not found');

    return this.analyzeForJob(userEmail, candidate, job);
  }

  /**
   * Auto-process: parse PDF, AI extracts name/email, ingest, analyze against ALL jobs.
   */
  async autoProcessCandidate(userEmail: string, file: Express.Multer.File) {
    // 1. Parse PDF to text first
    let cvText = '';
    let cvBuffer: Buffer | undefined = undefined;

    if (!file || !file.buffer) {
      throw new InternalServerErrorException('File or buffer is missing');
    }

    if (file.mimetype === 'text/plain') {
      cvText = file.buffer.toString('utf8');
    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        cvText = result.value;
      } catch (e: any) {
        this.logger.error(`DOCX parsing error: ${e.message}`);
        cvText = '[Unreadable DOCX content]';
      }
    } else if (file.mimetype.startsWith('image/')) {
      try {
        this.logger.log(`Using Gemini OCR for image type: ${file.mimetype}`);
        cvBuffer = file.buffer;
        const ocrText = await this.aiService.extractTextFromDocument(userEmail, file.buffer, file.mimetype);
        cvText = ocrText || `[Image CV - Could not extract text]`;
      } catch (e: any) {
        this.logger.error(`Image OCR parsing error: ${e.message}`);
        cvText = '[Image CV - OCR failed]';
      }
    } else {
      try {
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
        const pdfData = await parser.getText();
        cvText = pdfData.text || '';
        await parser.destroy();

        if (cvText.trim().length < 100 && file.mimetype === 'application/pdf') {
          this.logger.log('PDF text too short, using Gemini OCR');
          cvBuffer = file.buffer;
          const ocrText = await this.aiService.extractTextFromDocument(userEmail, cvBuffer, 'application/pdf');
          if (ocrText) cvText = ocrText;
        }
      } catch (e: any) {
        this.logger.warn(`PDF parse failed: ${e.message}`);
        if (file.mimetype === 'application/pdf' && file.buffer) {
          cvBuffer = file.buffer;
          try {
            const ocrText = await this.aiService.extractTextFromDocument(userEmail, file.buffer, 'application/pdf');
            cvText = ocrText || '[Scanned PDF]';
          } catch {
            cvText = '[Scanned PDF]';
          }
        } else {
          cvText = '[Unreadable]';
        }
      }
    }

    // 2. Use AI to extract candidate name and email from the CV
    const info = await this.aiService.extractCandidateInfo(userEmail, cvText, cvBuffer, file.mimetype);
    this.logger.log(`AI extracted: name="${info.name}", email="${info.email}"`);

    // 3. Ingest the candidate
    const candidate = await this.ingestCandidate(userEmail, info.name, info.email, file);

    // 4. Analyze against ALL jobs
    const analyses = await this.analyzeForAllJobs(userEmail, candidate);

    return { candidate, analyses };
  }

  async updateApplicationStage(userEmail: string, applicationId: string, stage: string) {
    const sb = this.supabaseService.getClient();

    // Verify ownership via join with jobs
    const { data: app, error: fetchError } = await sb
      .from('applications')
      .select('*, jobs!inner(user_email)')
      .eq('id', applicationId)
      .eq('jobs.user_email', userEmail)
      .single();

    if (fetchError || !app) throw new NotFoundException('Application not found or access denied');

    const { data, error } = await sb
      .from('applications')
      .update({ pipeline_stage: stage })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }
}
