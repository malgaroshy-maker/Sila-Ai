import { Injectable, InternalServerErrorException, NotFoundException, Logger, StreamableFile } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import { AiService } from '../ai/ai.service';
import { WebhooksService } from './webhooks.service';
import { google } from 'googleapis';

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
  async ingestCandidate(userEmail: string, name: string, email: string, file: Express.Multer.File, gmailMessageId?: string, gmailAttachmentId?: string) {
    const sb = this.supabaseService.getClient();

    // 1. Parse PDF buffer to text
    let cvText = '';
    let cvBuffer: Buffer | undefined = undefined;

    // Reject files larger than 10MB (extremely unlikely for a CV)
    if (file && file.size > 10 * 1024 * 1024) {
      this.logger.warn(`File ${file.originalname} is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Skipping.`);
      return null;
    }

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
        
        // Reject if more than 5 pages (CVs are rarely longer)
        if (pdfData.numpages > 5) {
          this.logger.warn(`PDF ${file.originalname} has ${pdfData.numpages} pages. Skipping (Max 5).`);
          await parser.destroy();
          return null;
        }

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
    
    // Fetch settings for duplicate strategy
    const { data: userSettings } = await sb
      .from('settings')
      .select('key, value')
      .eq('user_email', userEmail);
    
    const settingsMap = (userSettings || []).reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as any);

    const duplicateStrategy = settingsMap.duplicate_strategy || 'update';

    try {
      this.logger.log(`Extracting candidate info from CV text for ${email}...`);
      const extracted = await this.aiService.extractCandidateInfo(userEmail, cvText, cvBuffer, file.mimetype);
      
      if (!extracted.is_cv) {
        this.logger.warn(`Document for ${email} identified as non-CV. Skipping ingestion.`);
        return null; // Return null so caller knows to skip
      }

      // Only override if AI found something plausible (not "Unknown" or the default placeholder)
      if (extracted.name && extracted.name !== 'Unknown') {
        finalName = extracted.name;
      }
      if (extracted.email && extracted.email !== 'unknown@uploaded.cv' && extracted.email.includes('@')) {
        finalEmail = extracted.email;
      }
      
      this.logger.log(`Extraction result: ${finalName} <${finalEmail}> (Original: ${name} <${email}>)`);

      // Check for existing candidate BEFORE upsert if strategy is 'skip'
      if (duplicateStrategy === 'skip') {
        const { data: existing } = await sb
          .from('candidates')
          .select('id')
          .eq('user_email', userEmail)
          .eq('email', finalEmail)
          .single();
        
        if (existing) {
          this.logger.log(`Duplicate candidate ${finalEmail} found. Strategy is "skip". Skipping upsert.`);
          return existing;
        }
      }

    } catch (e: any) {
      this.logger.warn(`Candidate info extraction failed or non-CV detected: ${e.message}.`);
      // If we already returned null above, this won't be reached if it was a purposeful stop
    }

    // 1.7 Upload to Supabase Storage if it's a manual upload (no Gmail IDs)
    let cvUrl = undefined;
    if (!gmailMessageId && file && file.buffer) {
      // Sanitize filename: remove non-ASCII characters and special symbols to prevent Supabase 'Invalid key' error
      const safeOriginalName = file.originalname
        .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII (Arabic etc)
        .replace(/[\s\(\)\[\]\{\}\%\&\$\#\@\!\^\*]/g, '_') // Replace spaces and special chars
        .replace(/_{2,}/g, '_'); // Collapse multiple underscores
      
      const fileName = `${userEmail}/${Date.now()}_${safeOriginalName || 'uploaded_cv'}`;
      
      const { data: uploadData, error: uploadError } = await sb.storage
        .from('cv-backups')
        .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

      if (uploadError) {
        this.logger.error(`Manual CV upload to storage failed: ${uploadError.message}`);
      } else {
        const { data: { publicUrl } } = sb.storage.from('cv-backups').getPublicUrl(fileName);
        cvUrl = publicUrl;
      }
    }

    // 2. Upsert Candidate record
    const { data: candidate, error: candError } = await sb
      .from('candidates')
      .upsert({ 
        name: finalName, 
        email: finalEmail, 
        cv_text: cvText, 
        user_email: userEmail,
        cv_url: cvUrl, // Store the public URL for manual uploads
        gmail_message_id: gmailMessageId,
        gmail_attachment_id: gmailAttachmentId
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
    
    const { data: thresholdSettings } = await sb
      .from('settings')
      .select('key, value')
      .eq('user_email', userEmail)
      .eq('key', 'reject_threshold');
    
    const rejectThreshold = parseInt(thresholdSettings?.[0]?.value) || 0;

    const { data: analysisResult, metadata } = await this.aiService.analyzeCandidate(
      userEmail,
      { title: job.title, description: job.description, requirements: job.requirements },
      candidate.cv_text
    );

    let status = 'analyzed';
    if (rejectThreshold > 0 && analysisResult.final_score < rejectThreshold) {
      this.logger.log(`Candidate ${candidate.name} auto-rejected (Score ${analysisResult.final_score} < Threshold ${rejectThreshold})`);
      status = 'rejected';
    }

    // Create Application record
    const { data: application, error: appError } = await sb
      .from('applications')
      .upsert(
        { job_id: job.id, candidate_id: candidate.id, status },
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
        is_fresh_graduate: analysisResult.is_fresh_graduate || false,
        project_impact_score: analysisResult.project_impact_score || 0,
        cultural_fit_score: analysisResult.cultural_fit_score || 0,
        career_trajectory: analysisResult.career_trajectory || '',
        project_highlights: analysisResult.project_highlights || [],
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

    // Reject files larger than 10MB (extremely unlikely for a CV)
    if (file.size > 10 * 1024 * 1024) {
      this.logger.warn(`File ${file.originalname} is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Skipping.`);
      return { candidate: null, analyses: [], message: 'Skipped: File too large' };
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

        // Reject if more than 5 pages (CVs are rarely longer)
        if (pdfData.numpages > 5) {
          this.logger.warn(`PDF ${file.originalname} has ${pdfData.numpages} pages. Skipping (Max 5).`);
          await parser.destroy();
          return { candidate: null, analyses: [], message: 'Skipped: Too many pages' };
        }

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
    if (!candidate) {
      return { candidate: null, analyses: [], message: 'Skipped: Not a professional CV' };
    }

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
  async downloadCV(userEmail: string, candidateId: string) {
    const sb = this.supabaseService.getClient();

    // 1. Fetch candidate metadata
    const { data: candidate, error: candError } = await sb
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .eq('user_email', userEmail)
      .single();

    if (candError || !candidate) {
      throw new NotFoundException('Candidate not found');
    }

    // 2. If it's a Gmail attachment, download from Gmail API
    if (candidate.gmail_message_id && candidate.gmail_attachment_id) {
      this.logger.log(`Fetching Gmail attachment for ${candidate.email} (msg: ${candidate.gmail_message_id})`);

      // Get Gmail account for this user
      const { data: accounts } = await sb
        .from('email_accounts')
        .select('*')
        .eq('user_email', userEmail)
        .eq('provider', 'google');

      const account = accounts?.[0];
      if (!account) {
        this.logger.warn(`No Gmail account found to proxy download for ${userEmail}`);
        // Fallback to cv_url if exists
        return { url: candidate.cv_url };
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        access_token: account.access_token,
        refresh_token: account.refresh_token,
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      try {
        const attachment = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: candidate.gmail_message_id,
          id: candidate.gmail_attachment_id,
          quotaUser: account.email_address
        } as any);

        if (!attachment.data || !attachment.data.data) {
          this.logger.error(`Gmail API returned no data for msg=${candidate.gmail_message_id}, att=${candidate.gmail_attachment_id}`);
          throw new InternalServerErrorException('No data returned from Gmail API');
        }

        // Gmail uses base64url encoding
        let b64Data = attachment.data.data.replace(/-/g, '+').replace(/_/g, '/');
        // Add padding if needed
        while (b64Data.length % 4 !== 0) {
          b64Data += '=';
        }
        const buffer = Buffer.from(b64Data, 'base64');
        
        this.logger.log(`Successfully proxy-downloaded ${buffer.length} bytes for ${candidate.email}`);

        // Return structured object that controller can handle
        return {
          buffer,
          filename: `CV_${candidate.name.replace(/\s+/g, '_')}_Original.pdf`,
          mimetype: 'application/pdf' // Default to PDF for CVs
        };
      } catch (err: any) {
        this.logger.error(`Gmail download proxy failed: ${err.message}`);
        if (err.response) this.logger.error(`Gmail API Response: ${JSON.stringify(err.response.data)}`);
        // Fallback to cv_url if exists
        return { url: candidate.cv_url };
      }
    }

    // 3. Fallback to existing URL
    return { url: candidate.cv_url };
  }

  async deleteCandidate(userEmail: string, candidateId: string) {
    const sb = this.supabaseService.getClient();
    this.logger.log(`Deleting candidate ${candidateId} for user ${userEmail}`);

    // 1. Fetch candidate to get CV URL for storage cleanup
    const { data: candidate, error: fetchError } = await sb
      .from('candidates')
      .select('cv_url')
      .eq('id', candidateId)
      .eq('user_email', userEmail)
      .single();

    if (fetchError || !candidate) {
      throw new NotFoundException('Candidate not found or unauthorized');
    }

    // 2. Delete CV from storage if it exists
    if (candidate.cv_url) {
      try {
        // Extract filename from URL - URL format: .../storage/v1/object/public/cv-backups/user@email.com/123456_file.pdf
        const urlParts = candidate.cv_url.split('/cv-backups/');
        if (urlParts.length > 1) {
          const filePath = decodeURIComponent(urlParts[1]);
          this.logger.log(`Deleting CV file from storage: ${filePath}`);
          const { error: storageError } = await sb.storage
            .from('cv-backups')
            .remove([filePath]);
          
          if (storageError) {
            this.logger.error(`Failed to delete CV from storage: ${storageError.message}`);
          }
        }
      } catch (e: any) {
        this.logger.error(`Error parsing CV URL for deletion: ${e.message}`);
      }
    }

    // 3. Delete related records (Cascade should handle most, but being explicit for safety/clarity)
    // Explicitly delete embeddings
    await sb.from('candidate_embeddings').delete().eq('candidate_id', candidateId);
    
    // Now delete the candidate record (CASCADE should handle analysis_results and applications)
    const { error: deleteError } = await sb
      .from('candidates')
      .delete()
      .eq('id', candidateId)
      .eq('user_email', userEmail);

    if (deleteError) {
      this.logger.error(`Database deletion error: ${deleteError.message}`);
      throw new InternalServerErrorException(`Failed to delete candidate: ${deleteError.message}`);
    }

    return { success: true };
  }
}
