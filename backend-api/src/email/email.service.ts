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
  getGoogleAuthUrl(userEmail?: string) {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email'
    ];
    
    const state = userEmail ? Buffer.from(JSON.stringify({ userEmail })).toString('base64') : undefined;

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

      // Determine the overall recruiter (user_email)
      let recruiterEmail = emailAddress; // Fallback to the account's own email if no state provided
      if (state) {
        try {
          const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
          if (decoded.userEmail) {
            recruiterEmail = decoded.userEmail;
            this.logger.log(`Associating Gmail ${emailAddress} with recruiter ${recruiterEmail}`);
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
      return { success: true, email: emailAddress, message: 'Google account connected successfully' };
    } catch (error: any) {
      this.logger.error('Google Auth Error:', error);
      throw new InternalServerErrorException('Failed to authenticate with Google');
    }
  }

  // ==== MICROSOFT OUTLOOK OAUTH ====
  async getMicrosoftAuthUrl(userEmail?: string) {
    const state = userEmail ? Buffer.from(JSON.stringify({ userEmail })).toString('base64') : undefined;
    const authCodeUrlParameters = {
      scopes: ['user.read', 'mail.read', 'offline_access'],
      redirectUri: this.msRedirectUri,
      state
    };
    return await this.msalClient.getAuthCodeUrl(authCodeUrlParameters);
  }

  async handleMicrosoftCallback(code: string, state?: string) {
    try {
      const tokenRequest = {
        code,
        scopes: ['user.read', 'mail.read', 'offline_access'],
        redirectUri: this.msRedirectUri,
      };
      
      const response = await this.msalClient.acquireTokenByCode(tokenRequest);
      const emailAddress = response.account?.username;

      // Determine the overall recruiter (user_email)
      let recruiterEmail = emailAddress;
      if (state) {
        try {
          const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
          if (decoded.userEmail) {
            recruiterEmail = decoded.userEmail;
            this.logger.log(`Associating Outlook ${emailAddress} with recruiter ${recruiterEmail}`);
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
          access_token: response.accessToken,
          refresh_token: 'msal_managed_cache', 
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_email, email_address' })
        .select()
        .single();

      if (error) throw new InternalServerErrorException(error.message);
      return { success: true, email: emailAddress, message: 'Microsoft account connected successfully' };
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
