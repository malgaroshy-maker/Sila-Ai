import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';

@Injectable()
export class SettingsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getSettings(userEmail: string) {
    const sb = this.supabaseService.getClient();
    const { data, error } = await sb
      .from('settings')
      .select('*')
      .eq('user_email', userEmail);
    if (error) throw new InternalServerErrorException(error.message);

    const settings: any = {};
    data?.forEach((s) => {
      settings[s.key] = s.value;
    });

    // Also fetch the provider info
    const { data: accounts } = await sb
      .from('email_accounts')
      .select('provider, email_address')
      .eq('user_email', userEmail)
      .limit(1);
    if (accounts && accounts.length > 0) {
      settings.email_provider = accounts[0].provider;
      settings.connected_email = accounts[0].email_address;
    }

    return settings;
  }

  async updateSetting(userEmail: string, key: string, value: string) {
    const sb = this.supabaseService.getClient();
    const { error } = await sb.from('settings').upsert(
      {
        key,
        value,
        user_email: userEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_email, key' },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }

  async updateSettingsBatch(
    userEmail: string,
    settings: Record<string, string>,
  ) {
    const sb = this.supabaseService.getClient();
    const updates = Object.entries(settings).map(([key, value]) => ({
      key,
      value,
      user_email: userEmail,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await sb
      .from('settings')
      .upsert(updates, { onConflict: 'user_email, key' });
    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }

  async getAvailableModels(userEmail: string, apiKey?: string) {
    const currentSettings = await this.getSettings(userEmail);
    const key = apiKey || currentSettings.gemini_api_key;
    if (!key) return [];

    try {
      // Direct fetch from Google API to get all available models
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      );
      const data = await response.json();
      if (data.error) {
        console.error('Google API Error:', data.error);
        throw new Error(data.error.message);
      }

      if (!data.models) {
        console.warn('No models property in response:', data);
        return [];
      }

      console.log(
        `Found ${data.models.length} models for key ${key.substring(0, 5)}...`,
      );

      return data.models.map((m: any) => ({
        name: m.name.replace('models/', ''),
        displayName: m.displayName,
        description: m.description,
      }));
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
