import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { CandidatesModule } from '../candidates/candidates.module';
import { EmailModule } from '../email/email.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [CandidatesModule, EmailModule, AiModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService]
})
export class JobsModule {}
