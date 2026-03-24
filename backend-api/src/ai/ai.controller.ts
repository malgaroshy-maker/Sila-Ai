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
    if (!userEmail) {
      throw new UnauthorizedException('x-user-email header is required');
    }

    const sb = this.supabaseService.getClient();
    
    // Fetch logs for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await sb
      .from('ai_usage_logs')
      .select('*')
      .eq('user_email', userEmail)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch AI usage logs', error);
      return { data: [] };
    }

    return { data };
  }
}
