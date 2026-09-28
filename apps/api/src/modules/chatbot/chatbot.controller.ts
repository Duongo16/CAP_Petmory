import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { AskDto } from './dto/chatbot.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('assistant')
export class ChatbotController {
  constructor(private readonly service: ChatbotService) {}

  @Public()
  @Get('suggestions')
  suggestion() {
    return { suggestion: this.service.getInitialSuggestions() };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('ask')
  ask(@Body() dto: AskDto) {
    return this.service.ask(dto.question);
  }
}
