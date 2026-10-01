import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { DEMO_ACCOUNTS, DemoAccount } from './demo-accounts';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

class RefreshDto {
  @IsString()
  refreshToken!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly settings: ConfigService,
  ) {}

  /**
   * Cac tai khoan mau de dang nhap nhanh khi dang lam o may ca nhan.
   *
   * O che do that, duong nay tra ve danh sach rong, nen man hinh dang nhap
   * khong hien nut nao va khong co mat khau nao di ra ngoai.
   */
  @Public()
  @Get('demo-accounts')
  demoAccounts(): DemoAccount[] {
    const mode = this.settings.get<string>('nodeEnv') ?? 'development';
    return mode === 'production' ? [] : DEMO_ACCOUNTS;
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.service.register(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.service.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.service.forgotPassword(dto.email);
    /*
     * Cung mot cau tra loi du dia chi co that hay khong. Tra loi khac nhau
     * bien day thanh cach do xem ai da dang ky tai khoan o day.
     */
    return { ok: true };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.service.resetPassword(dto.token, dto.password);
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
