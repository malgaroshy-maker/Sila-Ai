import { Controller, Get, Post, Body, Query, Res, Redirect, Headers, Sse, MessageEvent, Param } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailProcessorService } from './email-processor.service';
import type { Response } from 'express';
import { fromEvent, Observable, map } from 'rxjs';

@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly emailProcessorService: EmailProcessorService
  ) {}

  @Sse('sync/progress/:userEmail')
  syncProgress(@Param('userEmail') userEmail: string): Observable<MessageEvent> {
    return fromEvent(this.emailProcessorService.progressEmitter, `progress:${userEmail}`).pipe(
      map((data: any) => ({ data } as MessageEvent)),
    );
  }

  @Post('sync/stop')
  async stopSync(@Headers('x-user-email') userEmail: string) {
    if (!userEmail) return { success: false, message: 'User email is required' };
    
    const sb = this.emailService.getSupabaseClient();
    const { error } = await sb.from('email_accounts')
      .update({ stop_sync_requested: true })
      .eq('user_email', userEmail);
      
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Sync stop requested' };
  }

  // ---- GOOGLE ROUTES ----
  @Get('auth/google')
  @Redirect()
  async googleAuth(@Query('userEmail') userEmail?: string, @Query('locale') locale: string = 'ar') {
    const url = this.emailService.getGoogleAuthUrl(userEmail, locale);
    return { url };
  }

  @Get('auth/google/callback')
  async googleCallback(
    @Query('code') code: string, 
    @Query('state') state: string,
    @Res() res: Response
  ) {
    if (!code) return res.status(400).send('No code provided');
    const authResult = await this.emailService.handleGoogleCallback(code, state);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectEmail = authResult.email; 
    const locale = authResult.locale || 'ar';
    return res.redirect(`${frontendUrl}/${locale}?email=${redirectEmail}`);
  }

  // ---- MICROSOFT ROUTES ----
  @Get('auth/microsoft')
  @Redirect()
  async microsoftAuth(@Query('userEmail') userEmail?: string, @Query('locale') locale: string = 'ar') {
    const url = await this.emailService.getMicrosoftAuthUrl(userEmail, locale);
    return { url };
  }

  @Get('auth/microsoft/callback')
  async microsoftCallback(
    @Query('code') code: string, 
    @Query('state') state: string,
    @Res() res: Response
  ) {
    if (!code) return res.status(400).send('No code provided');
    const authResult = await this.emailService.handleMicrosoftCallback(code, state);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const locale = authResult.locale || 'ar';
    return res.redirect(`${frontendUrl}/${locale}?email=${authResult.email}`);
  }

  // ---- UNIFIED SUPABASE AUTH STORAGE ----
  @Post('store-token')
  async storeToken(@Body() body: { provider: string, emailAddress: string, userEmail: string, accessToken: string, refreshToken: string | null }) {
    // If userEmail is not provided, fallback to emailAddress
    const recruiterEmail = body.userEmail || body.emailAddress;
    return this.emailService.storeProviderToken({ ...body, userEmail: recruiterEmail });
  }

  @Post('sync')
  async syncEmails(@Headers('x-user-email') userEmail: string) {
    if (!userEmail) return { message: 'x-user-email header is required' };

    const sb = this.emailService.getSupabaseClient();
    const { data: account } = await sb
      .from('email_accounts')
      .select('blocked_until')
      .eq('email_address', userEmail)
      .single();

    if (account?.blocked_until) {
      const blockedUntil = new Date(account.blocked_until).getTime();
      const now = Date.now();
      if (now < blockedUntil) {
        const remainingMins = Math.ceil((blockedUntil - now) / (60 * 1000));
        return { 
          message: `Sync is currently blocked by Google to protect your account. Please try again in ${remainingMins} minutes.`,
          blocked: true,
          remainingMins
        };
      }
    }

    // Manual sync always forces processing regardless of internal cooldown
    // Run in background (fire-and-forget) to prevent browser retries/timeouts
    this.emailProcessorService.handleCron(true).catch(err => {
      console.error('Manual sync background error:', err);
    });
    return { message: 'Sync triggered successfully in background', blocked: false };
  }
}
