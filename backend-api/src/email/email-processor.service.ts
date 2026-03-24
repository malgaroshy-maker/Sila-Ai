import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase.service';
import { CandidatesService } from '../candidates/candidates.service';
import { google } from 'googleapis';

@Injectable()
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);
  private isProcessing = false;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly candidatesService: CandidatesService
  ) {}

  @Cron('0 */15 * * * *')
  async handleCron() {
    if (this.isProcessing) {
      this.logger.debug('Email ingestion already in progress, skipping...');
      return;
    }

    this.isProcessing = true;
    this.logger.debug('Running email ingestion worker...');
    
    try {
      const sb = this.supabaseService.getClient();
      const { data: accounts, error } = await sb
        .from('email_accounts')
        .select('*');

      if (error || !accounts) {
        this.logger.error('Failed to fetch email accounts', error);
        return;
      }

      for (const account of accounts) {
        // Cooldown check: Don't sync more than once every 10 minutes per account
        const lastSynced = account.last_synced_at ? new Date(account.last_synced_at).getTime() : 0;
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        
        if (lastSynced > tenMinutesAgo) {
          this.logger.debug(`Skipping ${account.email_address} - synced recently`);
          continue;
        }

        if (account.provider === 'google') {
          await this.processGoogleAccount(account);
        }

        // Update last_synced_at
        await sb.from('email_accounts')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', account.id);
          
        // Small delay between different accounts
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (err) {
      this.logger.error('Global sync error', err);
    } finally {
      this.isProcessing = false;
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

      // Process only 5 messages at a time to stay under rate limits
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread has:attachment filename:pdf',
        maxResults: 5,
        includeSpamTrash: false
      });

      const messages = res.data.messages || [];
      if (messages.length === 0) return;

      this.logger.log(`Found ${messages.length} unread emails with PDFs for ${account.email_address}`);

      for (const msg of messages) {
        if (!msg.id) continue;

        // Moderate delay between individual message processing
        await new Promise(resolve => setTimeout(resolve, 1500));

        const msgDetails = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
        });

        const payload = msgDetails.data.payload;
        if (!payload || !payload.parts) continue;

        const fromHeader = payload.headers?.find(h => h.name === 'From')?.value || 'Unknown <unknown@example.com>';
        const emailMatch = fromHeader.match(/<([^>]+)>/);
        const candidateEmail = emailMatch ? emailMatch[1] : fromHeader;
        const candidateName = (fromHeader.split('<')[0] || candidateEmail).replace(/"/g, '').trim();

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

              await this.candidatesService.analyzeForAllJobs(account.email_address, candidate);
            }

            if (part.parts) {
              await extractAndIngest(part.parts);
            }
          }
        };

        await extractAndIngest(payload.parts);

        // Mark as read
        try {
          await gmail.users.messages.modify({
            userId: 'me',
            id: msg.id,
            requestBody: { removeLabelIds: ['UNREAD'] }
          });
        } catch (modifyError: any) {
          this.logger.warn(`Failed to mark email ${msg.id} as read: ${modifyError.message}`);
        }
      }

    } catch (error: any) {
      if (error.code === 429) {
        this.logger.warn(`Gmail Rate Limit hit for ${account.email_address}. Skipping for now.`);
      } else {
        this.logger.error(`Error processing Google account ${account.email_address}`, error);
      }
    }
  }
}
