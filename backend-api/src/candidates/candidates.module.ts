import { Module } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { CandidatesController } from './candidates.controller';
import { AiModule } from '../ai/ai.module';
import { WebhooksModule } from './webhooks.module';

@Module({
  imports: [AiModule, WebhooksModule],
  controllers: [CandidatesController],
  providers: [CandidatesService],
  exports: [CandidatesService]
})
export class CandidatesModule {}
