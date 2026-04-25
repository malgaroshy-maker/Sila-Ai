import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { VerificationService } from './verification.service';
import { TwilioService } from './twilio.service';
import { SupabaseModule } from '../supabase.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [SupabaseModule, AiModule],
  controllers: [WhatsAppController],
  providers: [VerificationService, TwilioService],
  exports: [VerificationService, TwilioService],
})
export class WhatsAppModule {}
