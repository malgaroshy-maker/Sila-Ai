import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AiService } from './src/ai/ai.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const aiService = app.get(AiService);

  const testEmail = 'malgaroshy@gmail.com'; // Use a known user email or just check for defaults
  console.log('--- Verifying Settings Retrieval ---');
  try {
    const settings = await aiService.getSettings(testEmail);
    console.log('Retrieved Settings:', JSON.stringify(settings, null, 2));
    
    if (settings.chatLanguage) {
      console.log('SUCCESS: chatLanguage found!');
    } else {
      console.error('FAILURE: chatLanguage NOT found!');
    }
  } catch (e) {
    console.error('Error fetching settings:', e.message);
  } finally {
    await app.close();
  }
}

bootstrap();
