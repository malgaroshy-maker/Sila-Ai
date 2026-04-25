import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  UnauthorizedException,
  BadRequestException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { VerificationService } from './verification.service';
import { TwilioService } from './twilio.service';
import { AiService } from '../ai/ai.service';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly twilioService: TwilioService,
    private readonly aiService: AiService,
  ) {}

  @Post('start')
  async startVerification(
    @Headers('x-user-email') userEmail: string,
    @Body() body: { application_id: string },
  ) {
    if (!userEmail) throw new UnauthorizedException('x-user-email header is required');
    if (!body.application_id) throw new BadRequestException('application_id is required');

    return this.verificationService.startVerification(body.application_id, userEmail);
  }

  @Post('webhook')
  async twilioWebhook(
    @Req() req: Request,
    @Body() body: any,
  ) {
    const twilioSignature = req.headers['x-twilio-signature'] as string;

    // Skip signature validation in development/sandbox mode
    // In production, verify the signature with the auth token
    // const isValid = this.twilioService.verifyWebhookSignature(
    //   req.originalUrl, twilioSignature, authToken,
    // );
    // if (!isValid) throw new UnauthorizedException('Invalid Twilio signature');

    const fromPhone = body.From?.replace('whatsapp:', '');
    const messageBody = body.Body;

    if (!fromPhone || !messageBody) {
      throw new BadRequestException('Missing From or Body in webhook payload');
    }

    await this.verificationService.handleIncomingMessage(fromPhone, messageBody);

    // Return empty 200 for Twilio
    return '';
  }

  @Get('sessions/:id')
  async getSession(
    @Headers('x-user-email') userEmail: string,
    @Param('id') sessionId: string,
  ) {
    if (!userEmail) throw new UnauthorizedException('x-user-email header is required');
    return this.verificationService.getSession(userEmail, sessionId);
  }

  @Get('candidate/:candidateId/latest')
  async getLatestForCandidate(
    @Headers('x-user-email') userEmail: string,
    @Param('candidateId') candidateId: string,
  ) {
    if (!userEmail) throw new UnauthorizedException('x-user-email header is required');
    return this.verificationService.getLatestForCandidate(userEmail, candidateId);
  }

  @Post('retry')
  async retrySession(
    @Headers('x-user-email') userEmail: string,
    @Body() body: { session_id: string },
  ) {
    if (!userEmail) throw new UnauthorizedException('x-user-email header is required');
    if (!body.session_id) throw new BadRequestException('session_id is required');

    return this.verificationService.retrySession(userEmail, body.session_id);
  }

  @Get('sandbox/status')
  async getSandboxStatus(@Headers('x-user-email') userEmail: string) {
    if (!userEmail) throw new UnauthorizedException('x-user-email header is required');
    const settings = await this.aiService.getSettings(userEmail);

    const hasSid = !!settings.whatsapp_twilio_sid;
    const hasToken = !!settings.whatsapp_twilio_token;
    const hasFrom = !!settings.whatsapp_twilio_from;
    const isEnabled = settings.whatsapp_enabled === 'true';

    return {
      enabled: isEnabled,
      configured: hasSid && hasToken && hasFrom,
      has_account_sid: hasSid,
      has_auth_token: hasToken,
      has_sender_number: hasFrom,
    };
  }
}
