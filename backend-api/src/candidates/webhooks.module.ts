import { Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { SupabaseService } from '../supabase.service';

@Module({
  providers: [WebhooksService, SupabaseService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
