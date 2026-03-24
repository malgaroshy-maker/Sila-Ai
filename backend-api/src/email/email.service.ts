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
  getGoogleAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email'
    ];
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async handleGoogleCallback(code: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Get user email
      const oauth2 = google.oauth2({ auth: this.oauth2Client, version: 'v2' });
      const userInfo = await oauth2.userinfo.get();
      const emailAddress = userInfo.data.email;

      // Save to Supabase
      const { data, error } = await this.supabaseService.getClient()
        .from('email_accounts')
        .upsert({
          provider: 'google',
          email_address: emailAddress,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email_address' })
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
  async getMicrosoftAuthUrl() {
    const authCodeUrlParameters = {
      scopes: ['user.read', 'mail.read', 'offline_access'],
      redirectUri: this.msRedirectUri,
    };
    return await this.msalClient.getAuthCodeUrl(authCodeUrlParameters);
  }

  async handleMicrosoftCallback(code: string) {
    try {
      const tokenRequest = {
        code,
        scopes: ['user.read', 'mail.read', 'offline_access'],
        redirectUri: this.msRedirectUri,
      };
      
      const response = await this.msalClient.acquireTokenByCode(tokenRequest);
      const emailAddress = response.account?.username;

      // Save to Supabase
      const { data, error } = await this.supabaseService.getClient()
        .from('email_accounts')
        .upsert({
          provider: 'microsoft',
          email_address: emailAddress,
          access_token: response.accessToken,
          // refresh_token is automatically maintained by msal token cache, but we might extract it if needed for offline jobs
          // MSAL Node abstract this away slightly if using TokenCache, but for simplicity we store what we have.
          refresh_token: 'msal_managed_cache', 
          updated_at: new Date().toISOString()
        }, { onConflict: 'email_address' })
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
  async storeProviderToken(body: { provider: string, emailAddress: string, accessToken: string, refreshToken: string | null }) {
    const { data, error } = await this.supabaseService.getClient()
      .from('email_accounts')
      .upsert({
        provider: body.provider,
        email_address: body.emailAddress,
        access_token: body.accessToken,
        refresh_token: body.refreshToken,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email_address' })
      .select()
      .single();

    if (error) {
      this.logger.error('Store Provider Token Error:', error);
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, email: body.emailAddress };
  }
}
