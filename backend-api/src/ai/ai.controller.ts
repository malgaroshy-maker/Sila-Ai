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

    // Get current model settings to provide accurate quota info
    const settings = await this.aiService.getSettings(userEmail);
    const quota = await this.aiService.getModelQuota(settings.model);

    // Calculate usage specifically for the current model
    const modelLogs = logs.filter(log => log.model_name === settings.model);
    const requestsUsedLocal = modelLogs.length;

    // Fetch Live Quota from headers if available (Workaround for Global Quota)
    const liveStatus = await this.aiService.getLiveQuota(settings.apiKey, settings.model);

    const summary = logs.reduce((acc, log) => {
      acc.total_input += log.input_tokens || 0;
      acc.total_output += log.output_tokens || 0;
      acc.total_cost += Number(log.est_cost || 0);
      return acc;
    }, { total_input: 0, total_output: 0, total_cost: 0 });

    // Determine the 'Real' remaining count
    // If liveStatus has last_seen_remaining, it's more accurate than our local logs
    const remaining = liveStatus?.last_seen_remaining !== null && liveStatus?.last_seen_remaining !== undefined
      ? liveStatus.last_seen_remaining 
      : Math.max(0, quota.rpd_limit - requestsUsedLocal);

    return { 
      logs,
      summary,
      requests_used_for_model: requestsUsedLocal,
      model_id: settings.model,
      model_display_name: quota.display_name,
      is_live: !!liveStatus,
      is_blocked: liveStatus?.is_blocked || false,
      approx_quota: {
        rpm_limit: quota.rpm_limit,
        tpm_limit: quota.tpm_limit,
        daily_limit: quota.rpd_limit,
        remaining_live: remaining,
        reset_at: liveStatus?.reset_at
      }
    };
  }

  @Get('models')
  async getModels() {
    return this.aiService.getModelCatalog();
  }
}
