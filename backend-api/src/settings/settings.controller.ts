import { Controller, Get, Post, Body, Query, Headers, UnauthorizedException } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  private requireEmail(email: string) {
    if (!email) throw new UnauthorizedException('x-user-email header is required');
  }

  @Get()
  async getSettings(@Headers('x-user-email') userEmail: string) {
    this.requireEmail(userEmail);
    return this.settingsService.getSettings(userEmail);
  }

  @Post('update')
  async updateSetting(@Headers('x-user-email') userEmail: string, @Body() body: { key: string, value: string }) {
    this.requireEmail(userEmail);
    return this.settingsService.updateSetting(userEmail, body.key, body.value);
  }

  @Post('batch')
  async updateSettingsBatch(@Headers('x-user-email') userEmail: string, @Body() settings: Record<string, string>) {
    this.requireEmail(userEmail);
    return this.settingsService.updateSettingsBatch(userEmail, settings);
  }

  @Get('models')
  async getModels(@Headers('x-user-email') userEmail: string, @Query('apiKey') apiKey: string) {
    this.requireEmail(userEmail);
    return this.settingsService.getAvailableModels(userEmail, apiKey);
  }
}
