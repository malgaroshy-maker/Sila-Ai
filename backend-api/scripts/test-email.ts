import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { EmailProcessorService } from './src/email/email-processor.service';
import * as fs from 'fs';

async function bootstrap() {
  console.log('Bootstrapping app context for manual email test...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const emailProcessor = app.get(EmailProcessorService);
  
  console.log('--- Triggering Email Processor manually ---');
  try {
    await emailProcessor.handleCron();
  } catch (e: any) {
    console.error('CRON ERROR captured to file.');
    fs.writeFileSync('error-log.json', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
  }
  console.log('--- Finished ---');
  
  await app.close();
}

bootstrap().catch(console.error);
