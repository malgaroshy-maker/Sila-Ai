import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('sessions')
  async getSessions(@Headers('x-user-email') userEmail: string) {
    if (!userEmail)
      throw new UnauthorizedException('x-user-email header is required');
    return this.chatService.getSessions(userEmail);
  }

  @Get('sessions/:id/messages')
  async getMessages(
    @Headers('x-user-email') userEmail: string,
    @Param('id') sessionId: string,
  ) {
    if (!userEmail)
      throw new UnauthorizedException('x-user-email header is required');
    return this.chatService.getMessages(userEmail, sessionId);
  }

  @Delete('sessions/:id')
  async deleteSession(
    @Headers('x-user-email') userEmail: string,
    @Param('id') sessionId: string,
  ) {
    if (!userEmail)
      throw new UnauthorizedException('x-user-email header is required');
    return this.chatService.deleteSession(userEmail, sessionId);
  }

  @Post()
  async chat(
    @Headers('x-user-email') userEmail: string,
    @Body()
    body: {
      message: string;
      history?: { role: string; text: string }[];
      sessionId?: string;
    },
  ) {
    if (!userEmail)
      throw new UnauthorizedException('x-user-email header is required');
    if (!body.message) return { response: 'Please provide a message.' };
    return this.chatService.chat(
      userEmail,
      body.message,
      body.history || [],
      body.sessionId,
    );
  }
}
