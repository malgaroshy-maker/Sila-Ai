import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase.service';
import { CandidatesService } from '../candidates/candidates.service';
import { google } from 'googleapis';
import { EventEmitter } from 'events';

@Injectable()
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);
  private isProcessing = false;
  public readonly progressEmitter = new EventEmitter();

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
    
    // Clear any previous stop requests at start
    const sb = this.supabaseService.getClient();
    await sb.from('email_accounts').update({ stop_sync_requested: false }).eq('stop_sync_requested', true);

    try {
      const { data: accounts, error } = await sb
        .from('email_accounts')
        .select('*');

      if (error || !accounts) {
        this.logger.error('Failed to fetch email accounts', error);
        this.isProcessing = false;
        return;
      }

      for (const account of accounts) {
        // Create/Update sync activity record
        const { data: activity } = await sb.from('sync_activity').upsert({
          user_email: account.user_email,
          status: 'scanning',
          current_action: 'Starting sync...',
          updated_at: new Date().toISOString()
        }).select().single();

        const emitProgress = (data: any) => {
          this.progressEmitter.emit(`progress:${account.user_email}`, data);
          // Also update DB occasionally (don't overwhelm)
          if (activity?.id && (data.status === 'completed' || data.status === 'failed' || data.status === 'stopped')) {
            sb.from('sync_activity').update({ 
               status: data.status, 
               processed_count: data.processed, 
               total_found: data.total,
               current_action: data.message,
               last_error: data.error
            }).eq('id', activity.id).then();
          }
        };

        // Check for active Google block
        if (account.blocked_until) {
          const blockedUntil = new Date(account.blocked_until).getTime();
          if (Date.now() < blockedUntil && !force) {
            this.logger.debug(`Skipping ${account.email_address} - blocked by Google until ${account.blocked_until}`);
            emitProgress({ status: 'failed', message: 'Blocked by Google (Rate Limit)', error: 'Rate limit' });
            continue;
          }
        }

        // 1. Fetch user settings for sync frequency
        const { data: userSettings } = await sb
          .from('settings')
          .select('key, value')
          .eq('user_email', account.user_email);
        
        const settingsMap = (userSettings || []).reduce((acc, s) => {
          acc[s.key] = s.value;
          return acc;
        }, {} as any);

        const syncFreq = settingsMap.sync_frequency || '6h';

        // 2. Cooldown check based on sync_frequency
        if (!force) {
          if (syncFreq === 'manual') {
            this.logger.debug(`Skipping ${account.email_address} - manual sync only`);
            continue;
          }

          const lastSynced = account.last_synced_at ? new Date(account.last_synced_at).getTime() : 0;
          let cooldownMs = 6 * 60 * 60 * 1000; // Default 6h
          
          if (syncFreq === '1h') cooldownMs = 60 * 60 * 1000;
          else if (syncFreq === '24h') cooldownMs = 24 * 60 * 60 * 1000;
          
          const nextAllowed = lastSynced + cooldownMs;
          if (Date.now() < nextAllowed) {
            this.logger.debug(`Skipping ${account.email_address} - frequency ${syncFreq} not yet elapsed`);
            continue;
          }
        }

        if (account.provider === 'google') {
          await this.processGoogleAccount(account, emitProgress);
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

  private async processGoogleAccount(account: any, onProgress: (data: any) => void) {
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
        q: 'is:unread has:attachment (filename:pdf OR filename:docx OR filename:doc OR filename:png OR filename:jpg OR filename:jpeg)',
        maxResults: 20,
        includeSpamTrash: false,
        quotaUser: qUser
      } as any);

      const messages = res.data.messages || [];
      if (messages.length === 0) {
        this.logger.log(`No new unread CVs found for ${account.email_address}`);
        onProgress({ status: 'completed', total: 0, processed: 0, message: 'No new emails found' });
        return;
      }

      onProgress({ status: 'analyzing', total: messages.length, processed: 0, message: `Found ${messages.length} potential emails` });

      let processedCount = 0;
      for (const msg of messages) {
        // --- CHECK STOP REQUEST ---
        const { data: acct } = await sb.from('email_accounts').select('stop_sync_requested').eq('id', account.id).single();
        if (acct?.stop_sync_requested) {
            this.logger.warn(`Sync stopped by user for ${account.email_address}`);
            onProgress({ status: 'stopped', total: messages.length, processed: processedCount, message: 'Stopped by user' });
            return;
        }

        if (!msg.id) continue;

        // Heuristic filtering: skip if snippet looks like it's clearly not a CV
        const snippet = msg.snippet || '';
        if (snippet.length > 0 && !this.isProbablyCV('', snippet)) {
            this.logger.debug(`Skipping email ${msg.id} - fails heuristic check: ${snippet.substring(0, 30)}...`);
            processedCount++;
            onProgress({ status: 'analyzing', total: messages.length, processed: processedCount, message: `Skipped non-CV email` });
            await this.markAsRead(gmail, msg.id, qUser);
            continue;
        }

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
              const filename = part.filename.toLowerCase();
              const isSupported = 
                filename.endsWith('.pdf') || 
                filename.endsWith('.docx') || 
                filename.endsWith('.doc') || 
                filename.endsWith('.png') || 
                filename.endsWith('.jpg') || 
                filename.endsWith('.jpeg');
              
              if (!isSupported) continue;

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
                .eq('user_email', account.user_email)
                .single();

              let candidate;
              if (existing && existing.cv_text && existing.cv_text.length > 50) {
                candidate = existing;
              } else {
                candidate = await this.candidatesService.ingestCandidate(
                  account.user_email, 
                  candidateName, 
                  candidateEmail, 
                  mockFile,
                  msg.id as string,
                  part.body.attachmentId
                );
              }

              if (candidate) {
                await this.candidatesService.analyzeForAllJobs(account.user_email, candidate, true);
              } else {
                this.logger.warn(`File ${part.filename} from ${candidateEmail} was not a CV. Skipping.`);
              }
            }

            if (part.parts) {
              await extractAndIngest(part.parts);
            }
          }
        };

        await extractAndIngest(payload.parts);
        processedCount++;
        onProgress({ status: 'analyzing', total: messages.length, processed: processedCount, message: `Processing ${processedCount}/${messages.length}...` });
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        await this.markAsRead(gmail, msg.id, qUser);
      }
      
      onProgress({ status: 'completed', total: messages.length, processed: processedCount, message: 'Sync completed successfully' });

    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      const errorCode = error.code || error.response?.status || error.status;
      
      this.logger.error(`Gmail API Error for ${account.email_address}: ${errorMessage} (Status: ${errorCode})`);

      // 403 (rateLimitExceeded) or 429 (Too Many Requests)
      const isRateLimit = 
        errorCode === 429 || 
        errorCode === 403 || 
        errorMessage.toLowerCase().includes('rate limit') || 
        errorMessage.toLowerCase().includes('retry after');

      if (isRateLimit) {
        // Parse "Retry after 2026-03-24T21:45:03.511Z"
        let blockTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // Default 30 mins
        
        const retryMatch = errorMessage.match(/Retry after\s+([\d-T:.Z]+)/i);
        if (retryMatch && retryMatch[1]) {
          // Add a 2-minute safety buffer to Google's time
          const googleTime = new Date(retryMatch[1]).getTime();
          blockTime = new Date(googleTime + 120 * 1000).toISOString();
          this.logger.warn(`Extracted precise block time from Google: ${blockTime}. Account will be skipped until then.`);
        } else {
          this.logger.warn(`Could not extract precise retry time from: "${errorMessage}". Using 30m default block.`);
        }
        
        await sb.from('email_accounts')
          .update({ 
            blocked_until: blockTime,
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

  private async markAsRead(gmail: any, messageId: string, quotaUser: string) {
    await gmail.users.messages.batchModify({
      userId: 'me',
      quotaUser,
      requestBody: {
        ids: [messageId],
        removeLabelIds: ['UNREAD'],
      },
    });
  }

  private isProbablyCV(filename: string, snippet: string): boolean {
    const cvKeywords = ['cv', 'resume', 'السيرة', 'الذاتية', 'application', 'profile', 'job', 'hiring', 'recruitment', 'experience', 'career'];
    const lowerFile = filename.toLowerCase();
    const lowerSnippet = snippet.toLowerCase();
    
    // If filename has CV keywords, it's very likely
    if (filename && cvKeywords.some(kw => lowerFile.includes(kw))) return true;
    
    // Filter out common non-CV noise (marketing, welcome emails, etc.)
    const noiseKeywords = [
      'unsubscribe', 'privacy policy', 'welcome to', 'subscription', 'verify your email', 
      'newsletter', 'promo', 'discount', 'invoice', 'receipt', 'shipping notice',
      'password reset', 'your order', 'one-time password', 'security alert'
    ];
    if (noiseKeywords.some(kw => lowerSnippet.includes(kw))) return false;

    // If snippet has CV keywords
    if (cvKeywords.some(kw => lowerSnippet.includes(kw))) return true;

    // If it has "Attached" and common CV extensions in text, it's a good candidate
    const attachmentKeywords = ['attach', 'file', 'cv', 'pdf', 'docx', 'resume'];
    if (attachmentKeywords.some(kw => lowerSnippet.includes(kw))) return true;

    // If it's a very short email without keywords, it's probably noise
    if (lowerSnippet.length < 50 && !cvKeywords.some(kw => lowerSnippet.includes(kw))) return false;

    return true; // Default to true to avoid missing potential CVs (AI check will be second line of defense)
  }
}
