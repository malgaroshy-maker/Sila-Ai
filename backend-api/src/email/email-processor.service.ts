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
        // Check for active Google block
        if (account.blocked_until) {
          const blockedUntil = new Date(account.blocked_until).getTime();
          if (Date.now() < blockedUntil && !force) {
            this.logger.debug(`Skipping ${account.email_address} - blocked by Google until ${account.blocked_until}`);
            continue;
          }
        }

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

        // Update last_synced_at IMMEDIATELY after account processing
        await sb.from('email_accounts')
          .update({ 
            last_synced_at: new Date().toISOString(),
            last_error_message: null // Clear errors on success attempt
          })
          .eq('id', account.id);
          
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (err) {
      this.logger.error('Global sync error', err);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processGoogleAccount(account: any) {
    const sb = this.supabaseService.getClient();
    try {
      this.logger.log(`Starting Gmail processing for ${account.email_address} (quotaUser isolation active)`);
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        access_token: account.access_token,
        refresh_token: account.refresh_token,
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Use quotaUser to bypass IP-based shared limits on Render
      const qUser = account.email_address;

      const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread has:attachment filename:pdf newer_than:2d',
        maxResults: 2,
        includeSpamTrash: false,
        quotaUser: qUser // CRITICAL FIX
      } as any);

      const messages = res.data.messages || [];
      if (messages.length === 0) {
        this.logger.log(`No new unread CVs found for ${account.email_address}`);
        return;
      }

      for (const msg of messages) {
        if (!msg.id) continue;

        await new Promise(resolve => setTimeout(resolve, 5000));

        const msgDetails = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          quotaUser: qUser // CRITICAL FIX
        } as any);

        const payload = msgDetails.data.payload;
        if (!payload || !payload.parts) {
            await this.markAsRead(gmail, msg.id, qUser);
            continue;
        }

        const fromHeader = payload.headers?.find(h => h.name === 'From')?.value || 'Unknown <unknown@example.com>';
        const emailMatch = fromHeader.match(/<([^>]+)>/);
        const candidateEmail = emailMatch ? emailMatch[1] : fromHeader;
        const candidateName = (fromHeader.split('<')[0] || candidateEmail).replace(/"/g, '').trim();

        const extractAndIngest = async (parts: any[]) => {
          for (const part of parts) {
            if (part.filename && part.body && part.body.attachmentId) {
              const isPdf = part.filename.toLowerCase().endsWith('.pdf');
              if (!isPdf) continue;

              await new Promise(resolve => setTimeout(resolve, 5000)); 

              const attachment = await gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: msg.id as string,
                id: part.body.attachmentId,
                quotaUser: qUser // CRITICAL FIX
              } as any);

              if (!attachment.data || typeof attachment.data.data !== 'string') continue;

              const b64Data = attachment.data.data.replace(/-/g, '+').replace(/_/g, '/');
              const buffer = Buffer.from(b64Data, 'base64');
              const mockFile = {
                originalname: part.filename,
                mimetype: part.mimeType,
                buffer: buffer,
                size: buffer.length
              } as Express.Multer.File;

              const { data: existing } = await sb
                .from('candidates')
                .select('id, name, email, cv_text')
                .eq('email', candidateEmail)
                .single();

              let candidate;
              if (existing && existing.cv_text && existing.cv_text.length > 50) {
                candidate = existing;
              } else {
                candidate = await this.candidatesService.ingestCandidate(account.email_address, candidateName, candidateEmail, mockFile);
              }

              await this.candidatesService.analyzeForAllJobs(account.email_address, candidate, true);
            }

            if (part.parts) {
              await extractAndIngest(part.parts);
            }
          }
        };

        await extractAndIngest(payload.parts);
        await new Promise(resolve => setTimeout(resolve, 3000));
        await this.markAsRead(gmail, msg.id, qUser);
      }

    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      this.logger.error(`Gmail API Error for ${account.email_address}: ${errorMessage}`);

      if (error.code === 429 || error.status === 429) {
        // Default to 30 mins backoff if no specific time found
        let backoffMins = 30;
        const oneHourFuture = new Date(Date.now() + backoffMins * 60 * 1000).toISOString();
        
        await sb.from('email_accounts')
          .update({ 
            blocked_until: oneHourFuture,
            last_error_message: `Google Rate Limit: ${errorMessage}`
          })
          .eq('id', account.id);
      } else {
        await sb.from('email_accounts')
          .update({ last_error_message: errorMessage })
          .eq('id', account.id);
      }
    }
  }

  private async markAsRead(gmail: any, msgId: string, qUser: string) {
    try {
      await gmail.users.messages.modify({
        userId: 'me',
        id: msgId,
        requestBody: { removeLabelIds: ['UNREAD'] },
        quotaUser: qUser // CRITICAL FIX
      } as any);
    } catch (modifyError: any) {
      this.logger.warn(`Failed to mark email ${msgId} as read: ${modifyError.message}`);
    }
  }
}
