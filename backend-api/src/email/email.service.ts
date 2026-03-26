import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import { google } from 'googleapis';
import * as msal from '@azure/msal-node';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly oauth2Client: any;
  private readonly msalClient: any;
  private readonly msRedirectUri: string;

  constructor(private supabaseService: SupabaseService) {
    // Construct redirect URIs dynamically if base URL is provided, otherwise fallback
    const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
    const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || `${backendUrl}/email/auth/google/callback`;
    this.msRedirectUri = process.env.MS_REDIRECT_URI || `${backendUrl}/email/auth/microsoft/callback`;

    this.logger.log(`Email Service initialized with Google Redirect: ${googleRedirectUri}`);

    // Google OAuth Setup
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || 'placeholder_google_id',
      process.env.GOOGLE_CLIENT_SECRET || 'placeholder_google_secret',
      googleRedirectUri
    );

    // Microsoft MSAL Setup
    this.msalClient = new msal.ConfidentialClientApplication({
      auth: {
        clientId: process.env.MS_CLIENT_ID || 'placeholder_ms_id',
        authority: 'https://login.microsoftonline.com/common',
        clientSecret: process.env.MS_CLIENT_SECRET || 'placeholder_ms_secret',
      }
    });
  }

  getSupabaseClient() {
    return this.supabaseService.getClient();
  }

  // ==== GOOGLE GMAIL OAUTH ====
  getGoogleAuthUrl(userEmail?: string, locale: string = 'ar') {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email'
    ];
    
    const state = Buffer.from(JSON.stringify({ userEmail, locale })).toString('base64');

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state
    });
  }

  async handleGoogleCallback(code: string, state?: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Get user email from the OAuth account
      const oauth2 = google.oauth2({ auth: this.oauth2Client, version: 'v2' });
      const userInfo = await oauth2.userinfo.get();
      const emailAddress = userInfo.data.email;

      // Determine the overall recruiter (user_email) and locale
      let recruiterEmail = emailAddress; // Fallback to the account's own email if no state provided
      let locale = 'ar';
      if (state) {
        try {
          const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
          if (decoded.userEmail) {
            recruiterEmail = decoded.userEmail;
            this.logger.log(`Associating Gmail ${emailAddress} with recruiter ${recruiterEmail}`);
          }
          if (decoded.locale) {
            locale = decoded.locale;
          }
        } catch (e) {
          this.logger.warn('Failed to decode OAuth state', e);
        }
      }

      // Save to Supabase with owner (user_email)
      const { data, error } = await this.supabaseService.getClient()
        .from('email_accounts')
        .upsert({
          provider: 'google',
          email_address: emailAddress,
          user_email: recruiterEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_email, email_address' })
        .select()
        .single();

      if (error) throw new InternalServerErrorException(error.message);
      return { success: true, email: emailAddress, locale, message: 'Google account connected successfully' };
    } catch (error: any) {
      this.logger.error('Google Auth Error:', error);
      throw new InternalServerErrorException('Failed to authenticate with Google');
    }
  }

  // ==== MICROSOFT OUTLOOK OAUTH ====
  async getMicrosoftAuthUrl(userEmail?: string, locale: string = 'ar') {
    const state = Buffer.from(JSON.stringify({ userEmail, locale })).toString('base64');
    const tenant = 'common';
    const clientId = process.env.MS_CLIENT_ID || '';
    const scopes = encodeURIComponent('offline_access user.read mail.read mail.readwrite');
    const redirectUri = encodeURIComponent(this.msRedirectUri);
    return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&response_mode=query&scope=${scopes}&state=${state}`;
  }

  async handleMicrosoftCallback(code: string, state?: string) {
    try {
      const tenant = 'common';
      const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams();
      params.append('client_id', process.env.MS_CLIENT_ID || '');
      params.append('client_secret', process.env.MS_CLIENT_SECRET || '');
      params.append('code', code);
      params.append('redirect_uri', this.msRedirectUri);
      params.append('grant_type', 'authorization_code');

      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const tokenData = await tokenRes.json();
      
      if (!tokenData.access_token) {
        throw new Error('Failed to get access token from Microsoft: ' + JSON.stringify(tokenData));
      }

      const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
         headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const graphData = await graphRes.json();
      const emailAddress = graphData.userPrincipalName || graphData.mail;

      // Determine the overall recruiter (user_email) and locale
      let recruiterEmail = emailAddress;
      let locale = 'ar';
      if (state) {
        try {
          const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
          if (decoded.userEmail) {
            recruiterEmail = decoded.userEmail;
            this.logger.log(`Associating Outlook ${emailAddress} with recruiter ${recruiterEmail}`);
          }
          if (decoded.locale) {
            locale = decoded.locale;
          }
        } catch (e) {
          this.logger.warn('Failed to decode Microsoft OAuth state', e);
        }
      }

      // Save to Supabase with owner (user_email)
      const { data, error } = await this.supabaseService.getClient()
        .from('email_accounts')
        .upsert({
          provider: 'microsoft',
          email_address: emailAddress,
          user_email: recruiterEmail,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token, 
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_email, email_address' })
        .select()
        .single();

      if (error) throw new InternalServerErrorException(error.message);
      return { success: true, email: emailAddress, locale, message: 'Microsoft account connected successfully' };
    } catch (error: any) {
      this.logger.error('Microsoft Auth Error:', error);
      throw new InternalServerErrorException('Failed to authenticate with Microsoft');
    }
  }

  // ==== UNIFIED SUPABASE OAUTH STORAGE ====
  async storeProviderToken(body: { provider: string, emailAddress: string, userEmail: string, accessToken: string, refreshToken: string | null }) {
    const { data, error } = await this.supabaseService.getClient()
      .from('email_accounts')
      .upsert({
        provider: body.provider,
        email_address: body.emailAddress,
        user_email: body.userEmail,
        access_token: body.accessToken,
        refresh_token: body.refreshToken,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_email, email_address' })
      .select()
      .single();

    if (error) {
      this.logger.error('Store Provider Token Error:', error);
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, email: body.emailAddress };
  }
}
