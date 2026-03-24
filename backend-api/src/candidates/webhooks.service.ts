import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import * as nodemailer from 'nodemailer';
import { google } from 'googleapis';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private transporter: nodemailer.Transporter | null = null;
  private isTestAccount = false;

  constructor(private readonly supabaseService: SupabaseService) {
    this.initTransporter();
  }

  private async initTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      this.logger.warn('No SMTP credentials found in env. Creating an Ethereal test account for email alerts...');
      const testAccount = await nodemailer.createTestAccount();
      this.isTestAccount = true;
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });
      this.logger.log(`Ethereal test account created: ${testAccount.user}`);
    }
  }

  async checkAndNotify(userEmail: string, candidateName: string, score: number, jobTitle: string) {
    if (score < 90) return;

    this.logger.log(`Exceptional candidate detected: ${candidateName} for ${jobTitle} with score ${score}`);

    // 1. Check if user has a webhook URL or if we should just email them
    const sb = this.supabaseService.getClient();
    const { data: settings } = await sb
      .from('settings')
      .select('webhook_url')
      .eq('user_email', userEmail)
      .single();

    if (settings?.webhook_url) {
      this.triggerWebhook(settings.webhook_url, {
        event: 'EXCEPTIONAL_CANDIDATE',
        candidateName,
        score,
        jobTitle,
        userEmail
      });
    }

    // 2. Send email notification anyway
    this.sendAlertEmail(userEmail, candidateName, score, jobTitle);
  }

  private async triggerWebhook(url: string, payload: any) {
    try {
      this.logger.log(`Triggering webhook: ${url}`);
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e: any) {
      this.logger.error(`Webhook trigger failed: ${e.message}`);
    }
  }

  private async sendAlertEmail(recipient: string, name: string, score: number, job: string) {
    const subjectText = `🚀 Exceptional Candidate Found: ${name}`;
    const htmlContent = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0369a1;">Exceptional Candidate Detected!</h2>
        <p>We found a high-potential candidate for your role: <strong>${job}</strong></p>
        <div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Name:</strong> ${name}</p>
          <p style="margin: 5px 0 0 0;"><strong>Final Match Score:</strong> <span style="color: #15803d; font-size: 1.2em;">${score}%</span></p>
        </div>
        <p>Please log in to the dashboard to review their profile and take action.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="font-size: 0.8em; color: #64748b;">This is an automated notification from your AI Recruitment Assistant.</p>
      </div>
    `;

    // Try to send via user's connected Gmail account first
    try {
      const sb = this.supabaseService.getClient();
      const { data: account } = await sb
        .from('email_accounts')
        .select('*')
        .eq('email_address', recipient)
        .eq('provider', 'google')
        .single();

      if (account && account.access_token) {
        // Check for active Google block before sending
        if (account.blocked_until) {
          const blockedUntil = new Date(account.blocked_until).getTime();
          if (Date.now() < blockedUntil) {
            this.logger.warn(`Skipping Gmail alert for ${recipient} - account is in Google cooldown until ${account.blocked_until}. Falling back to SMTP.`);
            // Continue to SMTP fallback
          } else {
            return await this.sendViaGmail(recipient, subjectText, htmlContent, account);
          }
        } else {
          return await this.sendViaGmail(recipient, subjectText, htmlContent, account);
        }
      }
    } catch (apiError: any) {
      this.logger.warn(`Failed to send via Gmail API: ${apiError.message}. Falling back to default SMTP...`);
    }

    // Fallback: Send via Transporter (SMTP / Ethereal)
    if (!this.transporter) {
      this.logger.warn('Transporter is not initialized yet. Skipping email alert.');
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: '"AI Recruitment Bot" <system@ai-recruit.com>',
        to: recipient,
        subject: subjectText,
        html: htmlContent
      });
      this.logger.log(`Alert email sent to ${recipient} via SMTP`);
      
      if (this.isTestAccount) {
        this.logger.log(`[TEST EMAIL] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    } catch (e: any) {
      this.logger.warn(`Failed to send alert email: ${e.message}`);
    }
  }

  private async sendViaGmail(recipient: string, subjectText: string, htmlContent: string, account: any) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || '',
      process.env.GOOGLE_CLIENT_SECRET || ''
    );
    
    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const utf8Subject = `=?utf-8?B?${Buffer.from(subjectText).toString('base64')}?=`;
    const messageParts = [
      `From: "AI Recruitment System" <${recipient}>`,
      `To: ${recipient}`,
      `Content-Type: text/html; charset=utf-8`,
      `MIME-Version: 1.0`,
      `Subject: ${utf8Subject}`,
      '',
      htmlContent
    ];
    
    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
      
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
      quotaUser: recipient
    } as any);
    
    this.logger.log(`✅ Alert email sent successfully to ${recipient} using their own Gmail API!`);
  }
}
