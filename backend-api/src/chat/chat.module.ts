import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';

import { AiModule } from '../ai/ai.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [AiModule, EmailModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
