import { Controller, Get, Post, Body, Query, Res, Redirect, Headers } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailProcessorService } from './email-processor.service';
import type { Response } from 'express';

@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly emailProcessorService: EmailProcessorService
  ) {}

  // ---- GOOGLE ROUTES ----
  @Get('auth/google')
  @Redirect()
  async googleAuth() {
    const url = this.emailService.getGoogleAuthUrl();
    return { url };
  }

  @Get('auth/google/callback')
  async googleCallback(@Query('code') code: string, @Res() res: Response) {
    if (!code) return res.status(400).send('No code provided');
    const authResult = await this.emailService.handleGoogleCallback(code);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/en?email=${authResult.email}`);
  }

  // ---- MICROSOFT ROUTES ----
  @Get('auth/microsoft')
  @Redirect()
  async microsoftAuth() {
    const url = await this.emailService.getMicrosoftAuthUrl();
    return { url };
  }

  @Get('auth/microsoft/callback')
  async microsoftCallback(@Query('code') code: string, @Res() res: Response) {
    if (!code) return res.status(400).send('No code provided');
    const authResult = await this.emailService.handleMicrosoftCallback(code);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/en?email=${authResult.email}`);
  }

  // ---- UNIFIED SUPABASE AUTH STORAGE ----
  @Post('store-token')
  async storeToken(@Body() body: { provider: string, emailAddress: string, accessToken: string, refreshToken: string | null }) {
    return this.emailService.storeProviderToken(body);
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
      if (Date.now() < blockedUntil) {
        const remainingMins = Math.ceil((blockedUntil - Date.now()) / (60 * 1000));
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
