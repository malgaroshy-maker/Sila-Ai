import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { JobsModule } from '../jobs/jobs.module';
import { SupabaseModule } from '../supabase.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [JobsModule, SupabaseModule, AiModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
