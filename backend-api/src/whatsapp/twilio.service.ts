import { Injectable, Logger } from '@nestjs/common';
const Twilio = require('twilio');

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);

  createClient(accountSid: string, authToken: string) {
    return Twilio(accountSid, authToken);
  }

  async sendMessage(
    accountSid: string,
    authToken: string,
    from: string,
    to: string,
    body: string,
  ): Promise<{ sid: string; status: string }> {
    const client = this.createClient(accountSid, authToken);

    try {
      const message = await client.messages.create({
        from: `whatsapp:${from}`,
        to: `whatsapp:${to}`,
        body,
      });

      this.logger.log(`WhatsApp message sent to ${to} — SID: ${message.sid}`);
      return { sid: message.sid, status: message.status };
    } catch (error: any) {
      this.logger.error(`Failed to send WhatsApp message to ${to}: ${error.message}`);
      throw error;
    }
  }

  verifyWebhookSignature(
    body: string,
    signature: string,
    authToken: string,
  ): boolean {
    try {
      return Twilio.validateRequest(authToken, signature, body, {});
    } catch {
      return false;
    }
  }
}
