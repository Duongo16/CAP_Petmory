import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ChatSessionService } from './chat-session.service';
import { HandoverDto, SessionAskDto } from './dto/chat-session.dto';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Hoi thoai ban day du, phia khach.
 *
 * Cac duong o day mo cho ca khach chua dang nhap, vi mot nguoi vua ghe qua
 * trang cung phai hoi duoc. Ma phien la mot chuoi ngau nhien dai, va chinh no
 * la chia khoa doc phien do.
 */
@Controller('assistant/sessions')
export class ChatSessionController {
  constructor(private readonly service: ChatSessionService) {}

  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post()
  open(@CurrentUser() user: AuthUser | null) {
    return this.service.open(user?.userId ?? null);
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

  @Public()
  @Get(':code')
  read(@Param('code') code: string, @CurrentUser() user: AuthUser | null) {
    return this.service.findFor(code, user?.userId ?? null);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(':code/ask')
  ask(
    @Param('code') code: string,
    @Body() dto: SessionAskDto,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.service.ask(code, user?.userId ?? null, dto.question);
  }

  /** Xin gap tu van vien. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(':code/handover')
  handover(
    @Param('code') code: string,
    @Body() dto: HandoverDto,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.service.handover(code, user?.userId ?? null, dto.note ?? '');
  }
}
