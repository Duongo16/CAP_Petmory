import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ChatSessionService } from './chat-session.service';
import { StaffReplyDto } from './dto/chat-session.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { DESK } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Hoi thoai ban day du, phia nhan vien.
 *
 * Viec truc va tra loi hoi thoai thuoc nhom Quan ly, cung nhom lo don hang va
 * san pham, vi nguoi truc thuong phai tra loi ngay ve gia va tien do.
 */
@Roles(...DESK)
@Controller('admin/chats')
export class ChatStaffController {
  constructor(private readonly service: ChatSessionService) {}

  /** Cac phien dang cho hoac dang duoc tra loi, nguoi cho lau nhat len truoc. */
  @Get()
  waiting() {
    return this.service.waitingList();
  }

  @Get(':code')
  read(@Param('code') code: string) {
    return this.service.readAsStaff(code);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':code/take')
  take(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.service.take(code, user.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':code/reply')
  reply(
    @Param('code') code: string,
    @Body() dto: StaffReplyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reply(code, user.userId, dto.text);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':code/close')
  close(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.service.close(code, user.userId);
  }
}
