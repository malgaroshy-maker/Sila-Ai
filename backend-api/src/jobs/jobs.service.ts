import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import { CandidatesService } from '../candidates/candidates.service';
import { EmailProcessorService } from '../email/email-processor.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class JobsService {
  constructor(
    private supabaseService: SupabaseService,
    private candidatesService: CandidatesService,
    private emailProcessorService: EmailProcessorService,
    private aiService: AiService,
  ) {}

  async createJob(userEmail: string, title: string, description: string, requirements: any) {
    const { data: job, error } = await this.supabaseService
      .getClient()
      .from('jobs')
      .insert([{ title, description, requirements, user_email: userEmail }])
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    // Background: analyze existing candidates against this new job
    this.processHistoricalCandidates(userEmail, job);
    // Background: deep scan emails for any missed CVs (they'll be ingested + matched to all jobs)
    this.emailProcessorService.handleCron();

    return job;
  }

  private async processHistoricalCandidates(userEmail: string, job: { id: string; title: string; description: string; requirements: any }) {
    try {
      const { data: candidates } = await this.supabaseService
        .getClient()
        .from('candidates')
        .select('*')
        .eq('user_email', userEmail);

      if (!candidates) return;

      for (const candidate of candidates) {
        if (!candidate.cv_text) continue;
        await this.candidatesService.analyzeForJob(userEmail, candidate, job);
      }
    } catch (e) {
      console.error('Historical matching failed', e);
    }
  }

  async getJobs(userEmail: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('jobs')
      .select('*')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async getJob(userEmail: string, id: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('jobs')
      .select('*')
      .eq('user_email', userEmail)
      .eq('id', id)
      .single();

    if (error) throw new NotFoundException('Job not found');
    return data;
  }

  async updateJob(userEmail: string, id: string, updates: any) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('jobs')
      .update(updates)
      .eq('user_email', userEmail)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async generateJob(userEmail: string, prompt: string) {
    const jobData = await this.aiService.generateJobFromText(userEmail, prompt);
    return this.createJob(userEmail, jobData.title, jobData.description, jobData.requirements);
  }

  async deleteJob(userEmail: string, id: string) {
    const { error } = await this.supabaseService
      .getClient()
      .from('jobs')
      .delete()
      .eq('user_email', userEmail)
      .eq('id', id);

    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }
}
