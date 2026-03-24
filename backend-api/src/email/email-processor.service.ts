import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase.service';
import { CandidatesService } from '../candidates/candidates.service';
import { google } from 'googleapis';

@Injectable()
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly candidatesService: CandidatesService
  ) {}

  @Cron('*/30 * * * * *')
  async handleCron() {
    this.logger.debug('Running email ingestion worker...');
    
    const { data: accounts, error } = await this.supabaseService.getClient()
      .from('email_accounts')
      .select('*');

    if (error || !accounts) {
      this.logger.error('Failed to fetch email accounts', error);
      return;
    }

    for (const account of accounts) {
      if (account.provider === 'google') {
        await this.processGoogleAccount(account);
      }
    }
  }

  private async processGoogleAccount(account: any) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        access_token: account.access_token,
        refresh_token: account.refresh_token,
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Search ALL emails with PDF attachments (read + unread + spam)
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'has:attachment filename:pdf',
        includeSpamTrash: true
      });

      const messages = res.data.messages || [];
      if (messages.length === 0) return;

      this.logger.log(`Found ${messages.length} emails with PDFs for ${account.email_address}`);

      for (const msg of messages) {
        if (!msg.id) continue;

        const msgDetails = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
        });

        const payload = msgDetails.data.payload;
        if (!payload || !payload.parts) continue;

        // Extract Candidate Name and Email from 'From' header
        const fromHeader = payload.headers?.find(h => h.name === 'From')?.value || 'Unknown <unknown@example.com>';
        const emailMatch = fromHeader.match(/<([^>]+)>/);
        const candidateEmail = emailMatch ? emailMatch[1] : fromHeader;
        const candidateName = (fromHeader.split('<')[0] || candidateEmail).replace(/"/g, '').trim();

        // Phase 1: Ingest all CVs (parse PDF, store candidate)
        const extractAndIngest = async (parts: any[]) => {
          for (const part of parts) {
            if (part.filename && part.body && part.body.attachmentId) {
              if (!part.filename.toLowerCase().endsWith('.pdf')) continue;

              const attachment = await gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: msg.id as string,
                id: part.body.attachmentId
              });

              if (!attachment.data || typeof attachment.data.data !== 'string') continue;

              const b64Data = attachment.data.data.replace(/-/g, '+').replace(/_/g, '/');
              const buffer = Buffer.from(b64Data, 'base64');
              const mockFile = {
                originalname: part.filename,
                mimetype: part.mimeType,
                buffer: buffer,
                size: buffer.length
              } as Express.Multer.File;

              // Check if this candidate already exists (prevent re-parsing the same PDF)
              const sb = this.supabaseService.getClient();
              const { data: existing } = await sb
                .from('candidates')
                .select('id, name, email, cv_text')
                .eq('email', candidateEmail)
                .single();

              let candidate;
              if (existing && existing.cv_text && existing.cv_text.length > 50) {
                this.logger.debug(`Skipping ingestion for ${candidateEmail} — already in DB`);
                candidate = existing;
              } else {
                this.logger.log(`Ingesting CV: ${part.filename} from ${candidateName} (${candidateEmail})`);
                candidate = await this.candidatesService.ingestCandidate(account.email_address, candidateName, candidateEmail, mockFile);
              }

              // Analyze against ALL jobs (skips already-analyzed pairs)
              await this.candidatesService.analyzeForAllJobs(account.email_address, candidate);
            }

            if (part.parts) {
              await extractAndIngest(part.parts);
            }
          }
        };

        if (payload.parts) {
          await extractAndIngest(payload.parts);
        }

        // Try to mark as read
        try {
              await gmail.users.messages.modify({
                userId: 'me',
                id: msg.id,
                requestBody: {
                  removeLabelIds: ['UNREAD']
                }
              });
        } catch (modifyError: any) {
          // Silently ignore — insufficient scopes or already read
        }
      }

    } catch (error: any) {
      this.logger.error(`Error processing Google account ${account.email_address}`);
      throw error;
    }
  }
}
