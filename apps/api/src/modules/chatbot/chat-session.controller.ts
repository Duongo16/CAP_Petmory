import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ChatSessionService } from './chat-session.service';
import { HandoverDto, SessionAskDto } from './dto/chat-session.dto';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Hoi thoai ban day du, phia khach.
 *
 * Moi duong o day can dang nhap. Phien luon gan voi mot tai khoan, va chi chu
 * phien moi doc hay hoi tiep duoc trong phien do.
 */
@Controller('assistant/sessions')
export class ChatSessionController {
  constructor(private readonly service: ChatSessionService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post()
  open(@CurrentUser() user: AuthUser) {
    return this.service.open(user.userId);
  }

  /**
   * Phien dang mo gan nhat cua nguoi dang dang nhap.
   *
   * Dat truoc duong co tham so, neu khong thi chu mine se bi hieu la mot ma
   * phien.
   */
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.service.latestOf(user.userId);
  }

  @Get(':code')
  read(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.service.findFor(code, user.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':code/ask')
  ask(@Param('code') code: string, @Body() dto: SessionAskDto, @CurrentUser() user: AuthUser) {
    return this.service.ask(code, user.userId, dto.question);
  }

  /** Xin gap tu van vien. */
  @HttpCode(HttpStatus.OK)
  @Post(':code/handover')
  handover(@Param('code') code: string, @Body() dto: HandoverDto, @CurrentUser() user: AuthUser) {
    return this.service.handover(code, user.userId, dto.note ?? '');
  }
}
