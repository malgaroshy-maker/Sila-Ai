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
  async handleCron(force = false) {
    if (this.isProcessing) {
      this.logger.debug(`Email ingestion already in progress (force: ${force}), skipping...`);
      return;
    }

    this.isProcessing = true;
    this.logger.debug(`Running email ingestion worker (force: ${force})...`);
    
    try {
      const sb = this.supabaseService.getClient();
      const { data: accounts, error } = await sb
        .from('email_accounts')
        .select('*');

      if (error || !accounts) {
        this.logger.error('Failed to fetch email accounts', error);
        this.isProcessing = false;
        return;
      }

      for (const account of accounts) {
        // Cooldown check: Don't sync more than once every 5 minutes per account (unless forced)
        const lastSynced = account.last_synced_at ? new Date(account.last_synced_at).getTime() : 0;
        const cooldownMs = 5 * 60 * 1000;
        const nextAllowed = lastSynced + cooldownMs;
        
        if (!force && Date.now() < nextAllowed) {
          this.logger.debug(`Skipping ${account.email_address} - synced recently`);
          continue;
        }

        if (account.provider === 'google') {
          await this.processGoogleAccount(account);
        }

        // Update last_synced_at IMMEDIATELY after account processing to prevent rapid re-runs
        await sb.from('email_accounts')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', account.id);
          
        // Small delay between different accounts
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (err) {
      this.logger.error('Global sync error', err);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processGoogleAccount(account: any) {
    try {
      this.logger.log(`Starting Gmail processing for ${account.email_address}...`);
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        access_token: account.access_token,
        refresh_token: account.refresh_token,
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Search UNREAD emails with PDF attachments - Limit to 2 for safety
      this.logger.debug(`Calling gmail.users.messages.list for ${account.email_address}...`);
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread has:attachment filename:pdf newer_than:2d',
        maxResults: 2,
        includeSpamTrash: false
      });

      const messages = res.data.messages || [];
      if (messages.length === 0) {
        this.logger.log(`No new unread CVs found for ${account.email_address}`);
        return;
      }

      this.logger.log(`Found ${messages.length} unread emails with PDFs for ${account.email_address}. Processing slowly...`);

      for (const msg of messages) {
        if (!msg.id) continue;

        // AGGRESSIVE THROTTLING: 5 seconds between every major step
        await new Promise(resolve => setTimeout(resolve, 5000));

        this.logger.debug(`Calling gmail.users.messages.get for ID: ${msg.id}...`);
        const msgDetails = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
        });

        const payload = msgDetails.data.payload;
        if (!payload || !payload.parts) {
            // Mark as read anyway if it has no readable parts to avoid re-scanning
            await this.markAsRead(gmail, msg.id);
            continue;
        }

        const fromHeader = payload.headers?.find(h => h.name === 'From')?.value || 'Unknown <unknown@example.com>';
        const emailMatch = fromHeader.match(/<([^>]+)>/);
        const candidateEmail = emailMatch ? emailMatch[1] : fromHeader;
        const candidateName = (fromHeader.split('<')[0] || candidateEmail).replace(/"/g, '').trim();

        let ingestedAny = false;

        const extractAndIngest = async (parts: any[]) => {
          for (const part of parts) {
            if (part.filename && part.body && part.body.attachmentId) {
              const isPdf = part.filename.toLowerCase().endsWith('.pdf');
              const isDocx = part.filename.toLowerCase().endsWith('.docx');
              const isImg = /\.(jpg|jpeg|png)$/i.test(part.filename);

              if (!isPdf && !isDocx && !isImg) continue;

              await new Promise(resolve => setTimeout(resolve, 5000)); 

              this.logger.debug(`Calling gmail.users.messages.attachments.get for ${part.filename}...`);
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

              // Silent analysis
              await this.candidatesService.analyzeForAllJobs(account.email_address, candidate, true);
              ingestedAny = true;
            }

            if (part.parts) {
              await extractAndIngest(part.parts);
            }
          }
        };

        await extractAndIngest(payload.parts);

        // Always mark as read after processing an email (success or failure) to avoid loops
        await new Promise(resolve => setTimeout(resolve, 3000));
        await this.markAsRead(gmail, msg.id);
      }

    } catch (error: any) {
      if (error.code === 429) {
        this.logger.warn(`Gmail Rate Limit hit for ${account.email_address}. Backing off for 1 hour.`);
        const oneHourFuture = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await this.supabaseService.getClient()
          .from('email_accounts')
          .update({ last_synced_at: oneHourFuture })
          .eq('id', account.id);
      } else {
        this.logger.error(`Error processing Google account ${account.email_address}`, error);
      }
    }
  }

  private async markAsRead(gmail: any, msgId: string) {
    try {
      this.logger.debug(`Marking email ${msgId} as read...`);
      await gmail.users.messages.modify({
        userId: 'me',
        id: msgId,
        requestBody: { removeLabelIds: ['UNREAD'] }
      });
    } catch (modifyError: any) {
      this.logger.warn(`Failed to mark email ${msgId} as read: ${modifyError.message}`);
    }
  }
}
