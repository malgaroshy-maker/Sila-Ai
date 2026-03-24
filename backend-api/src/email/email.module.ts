import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { EmailProcessorService } from './email-processor.service';
import { SupabaseService } from '../supabase.service';
import { CandidatesModule } from '../candidates/candidates.module';

@Module({
  imports: [CandidatesModule],
  providers: [EmailService, EmailProcessorService],
  controllers: [EmailController],
  exports: [EmailProcessorService]
})
export class EmailModule {}
