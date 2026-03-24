import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { JobsModule } from '../jobs/jobs.module';
import { SupabaseModule } from '../supabase.module';

@Module({
  imports: [JobsModule, SupabaseModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
