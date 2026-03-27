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
    if (
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    ) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      this.logger.warn(
        'No SMTP credentials found in env. Creating an Ethereal test account for email alerts...',
      );
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
  async checkAndNotify(
    userEmail: string,
    candidateName: string,
    score: number,
    jobTitle: string,
  ) {
    // 1. Check if user has a webhook URL or custom threshold
    const sb = this.supabaseService.getClient();
    const { data: userSettings } = await sb
      .from('settings')
      .select('key, value')
      .eq('user_email', userEmail)
      .in('key', ['webhook_url', 'exceptional_threshold']);

    const settingsMap = (userSettings || []).reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as any);

    const threshold = parseInt(settingsMap.exceptional_threshold) || 90;

    if (score < threshold) {
      this.logger.debug(
        `Score ${score} is below threshold ${threshold} for ${userEmail}. Skipping notify.`,
      );
      return;
    }

    this.logger.log(
      `Exceptional candidate detected: ${candidateName} for ${jobTitle} with score ${score} (Threshold: ${threshold})`,
    );

    if (settingsMap.webhook_url) {
      this.triggerWebhook(settingsMap.webhook_url, {
        event: 'EXCEPTIONAL_CANDIDATE',
        candidateName,
        score,
        jobTitle,
        userEmail,
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
        body: JSON.stringify(payload),
      });
    } catch (e: any) {
      this.logger.error(`Webhook trigger failed: ${e.message}`);
    }
  }

  private async sendAlertEmail(
    recipient: string,
    name: string,
    score: number,
    job: string,
  ) {
    const subjectText = `🚀 Exceptional Candidate Found: ${name} | مرشح استثنائي جديد`;
    const htmlContent = `
      <div dir="ltr" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px; margin: auto; background-color: #ffffff;">
        
        <!-- English Section -->
        <div style="margin-bottom: 30px; border-bottom: 2px dashed #f1f5f9; padding-bottom: 20px;">
          <h2 style="color: #0369a1; margin-top: 0;">Exceptional Candidate Detected!</h2>
          <p style="color: #334155; line-height: 1.6;">We found a high-potential candidate for your role: <strong style="color: #0ea5e9;">${job}</strong></p>
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #0ea5e9;">
            <p style="margin: 0; color: #1e293b;"><strong>Name:</strong> ${name}</p>
            <p style="margin: 10px 0 0 0; color: #1e293b;"><strong>Match Score:</strong> <span style="color: #15803d; font-size: 1.4em; font-weight: bold;">${score}%</span></p>
          </div>
          <p style="margin-top: 20px; color: #64748b; font-size: 0.95em;">Please log in to your recruitment dashboard to review the profile.</p>
        </div>

        <!-- Arabic Section -->
        <div dir="rtl" style="text-align: right;">
          <h2 style="color: #0369a1; margin-top: 0;">تم اكتشاف مرشح استثنائي!</h2>
          <p style="color: #334155; line-height: 1.6;">لقد وجدنا مرشحاً يتمتع بإمكانيات عالية لوظيفتك الشاغرة: <strong style="color: #0ea5e9;">${job}</strong></p>
          <div style="background: #fdf2f8; padding: 20px; border-radius: 8px; border-right: 4px solid #db2777;">
            <p style="margin: 0; color: #1e293b;"><strong>الاسم:</strong> ${name}</p>
            <p style="margin: 10px 0 0 0; color: #1e293b;"><strong>درجة المطابقة:</strong> <span style="color: #15803d; font-size: 1.4em; font-weight: bold;">${score}%</span></p>
          </div>
          <p style="margin-top: 20px; color: #64748b; font-size: 0.95em;">يرجى تسجيل الدخول إلى لوحة التحكم الخاصة بك لمراجعة الملف الشخصي.</p>
        </div>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 30px 0;">
        <p style="font-size: 0.8em; color: #94a3b8; text-align: center;">
          This is an automated notification from your AI Recruitment System.<br>
          هذا إشعار تلقائي من نظام التوظيف بالذكاء الاصطناعي الخاص بك.
        </p>
      </div>
    `;

    // Try to send via user's connected Gmail/Microsoft account first
    try {
      const sb = this.supabaseService.getClient();
      const { data: account } = await sb
        .from('email_accounts')
        .select('*')
        .eq('email_address', recipient)
        .in('provider', ['google', 'microsoft'])
        .single();

      if (account && account.access_token) {
        // Check for active provider block before sending
        if (account.blocked_until) {
          const blockedUntil = new Date(account.blocked_until).getTime();
          if (Date.now() < blockedUntil) {
            this.logger.warn(
              `Skipping API alert for ${recipient} - account is in cooldown until ${account.blocked_until}. Falling back to SMTP.`,
            );
          } else {
            if (account.provider === 'google') {
              return await this.sendViaGmail(
                recipient,
                subjectText,
                htmlContent,
                account,
              );
            } else if (account.provider === 'microsoft') {
              return await this.sendViaMicrosoft(
                recipient,
                subjectText,
                htmlContent,
                account,
              );
            }
          }
        } else {
          if (account.provider === 'google') {
            return await this.sendViaGmail(
              recipient,
              subjectText,
              htmlContent,
              account,
            );
          } else if (account.provider === 'microsoft') {
            return await this.sendViaMicrosoft(
              recipient,
              subjectText,
              htmlContent,
              account,
            );
          }
        }
      }
    } catch (apiError: any) {
      const errorMessage =
        apiError.response?.data?.error?.message || apiError.message || apiError;
      const errorCode =
        apiError.code || apiError.response?.status || apiError.status || 500;

      this.logger.warn(
        `Failed to send via API: ${errorMessage} (Status: ${errorCode}). Falling back to default SMTP...`,
      );

      // 403 (rateLimitExceeded) or 429 (Too Many Requests)
      const isRateLimit =
        errorCode === 429 ||
        errorCode === 403 ||
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.toLowerCase().includes('retry after');

      if (isRateLimit) {
        let blockTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // Default 30 mins

        const retryMatch = errorMessage.match(/Retry after\s+([\d-T:.Z]+)/i);
        if (retryMatch && retryMatch[1]) {
          const googleTime = new Date(retryMatch[1]).getTime();
          blockTime = new Date(googleTime + 120 * 1000).toISOString();
          this.logger.warn(
            `Detected Gmail rate limit. Setting block until ${blockTime}`,
          );
        }

        try {
          const sb = this.supabaseService.getClient();
          await sb
            .from('email_accounts')
            .update({ blocked_until: blockTime })
            .eq('email_address', recipient);
        } catch (dbErr) {
          this.logger.error(`Failed to update blocked_until: ${dbErr.message}`);
        }
      }
    }

    // Fallback: Send via Transporter (SMTP / Ethereal)
    if (!this.transporter) {
      this.logger.warn(
        'Transporter is not initialized yet. Skipping email alert.',
      );
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: '"AI Recruitment Bot" <system@ai-recruit.com>',
        to: recipient,
        subject: subjectText,
        html: htmlContent,
      });
      this.logger.log(`Alert email sent to ${recipient} via SMTP`);

      if (this.isTestAccount) {
        this.logger.log(
          `[TEST EMAIL] Preview URL: ${nodemailer.getTestMessageUrl(info)}`,
        );
      }
    } catch (e: any) {
      this.logger.warn(`Failed to send alert email: ${e.message}`);
    }
  }

  private async refreshMicrosoftToken(account: any): Promise<string> {
    const tenant = 'common';
    const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append('client_id', process.env.MS_CLIENT_ID || '');
    params.append('client_secret', process.env.MS_CLIENT_SECRET || '');
    params.append('refresh_token', account.refresh_token);
    params.append('grant_type', 'refresh_token');

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    if (!data.access_token) {
      throw new Error(
        'Failed to refresh Microsoft token: ' + JSON.stringify(data),
      );
    }

    const sb = this.supabaseService.getClient();
    await sb
      .from('email_accounts')
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token || account.refresh_token,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id);

    return data.access_token;
  }

  private async sendViaMicrosoft(
    recipient: string,
    subjectText: string,
    htmlContent: string,
    account: any,
  ) {
    let accessToken = account.access_token;

    try {
      accessToken = await this.refreshMicrosoftToken(account);
    } catch (e: any) {
      this.logger.error(
        `Failed to refresh MS token for ${recipient}: ${e.message}`,
      );
    }

    const graphApiUrl = `https://graph.microsoft.com/v1.0/me/sendMail`;

    const response = await fetch(graphApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: subjectText,
          body: {
            contentType: 'HTML',
            content: htmlContent,
          },
          toRecipients: [
            {
              emailAddress: {
                address: recipient,
              },
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Graph API error: ${response.status} ${await response.text()}`,
      );
    }

    this.logger.log(
      `✅ Alert email sent successfully to ${recipient} using Microsoft Graph API!`,
    );
  }

  private async sendViaGmail(
    recipient: string,
    subjectText: string,
    htmlContent: string,
    account: any,
  ) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || '',
      process.env.GOOGLE_CLIENT_SECRET || '',
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
      htmlContent,
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
      quotaUser: recipient,
    } as any);

    this.logger.log(
      `✅ Alert email sent successfully to ${recipient} using their own Gmail API!`,
    );
  }
}
