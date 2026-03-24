import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(
    @Headers('x-user-email') userEmail: string,
    @Body() body: { message: string; history?: { role: string; text: string }[] }
  ) {
    if (!userEmail) throw new UnauthorizedException('x-user-email header is required');
    if (!body.message) return { response: 'Please provide a message.' };
    return this.chatService.chat(userEmail, body.message, body.history || []);
  }
}
