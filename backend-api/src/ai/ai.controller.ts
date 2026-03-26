import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { AiService } from './ai.service';
import { SupabaseService } from '../supabase.service';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get('usage')
  async getUsageLogs(@Headers('x-user-email') userEmail: string) {
    if (!userEmail) throw new UnauthorizedException('x-user-email header is required');

    const sb = this.supabaseService.getClient();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: logs, error } = await sb
      .from('ai_usage_logs')
      .select('*')
      .eq('user_email', userEmail)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
       console.error('Failed to fetch AI usage logs', error);
       return { logs: [], summary: { total_input: 0, total_output: 0, total_cost: 0 } };
    }

    const summary = logs.reduce((acc, log) => {
      acc.total_input += log.input_tokens || 0;
      acc.total_output += log.output_tokens || 0;
      acc.total_cost += Number(log.est_cost || 0);
      return acc;
    }, { total_input: 0, total_output: 0, total_cost: 0 });

    return { 
      logs,
      summary,
      // Quota awareness - approximate based on common free-tier limits if no headers exist
      approx_quota: {
        rpm_limit: 15, // standard free tier for flash
        tpm_limit: 1000000,
        daily_limit: 1500
      }
    };
  }

  @Get('models')
  async getModels() {
    return this.aiService.getModelCatalog();
  }
}
