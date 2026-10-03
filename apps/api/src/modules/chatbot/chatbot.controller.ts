import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { AskDto } from './dto/chatbot.dto';

/**
 * Tro ly ban co ban. Chi danh cho nguoi da dang nhap, giong moi chuc nang
 * tri tue nhan tao khac cua he thong.
 */
@Controller('assistant')
export class ChatbotController {
  constructor(private readonly service: ChatbotService) {}

  @Get('suggestions')
  suggestion() {
    return this.service.suggestions().then((suggestion) => ({ suggestion }));
  }

  @HttpCode(HttpStatus.OK)
  @Post('ask')
  ask(@Body() dto: AskDto) {
    return this.service.ask(dto.question);
  }
}
