import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { MSG } from '../../common/constants/messages';
import { Role } from '../../common/constants/roles';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string; roles: Role[] };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<LoginResult> {
    const user = await this.users.createNext(dto);
    return this.issueTokens(user.id, user.email, user.fullName, user.roles);
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    if (!user || !user.active) {
      throw new UnauthorizedException(MSG.BAD_CREDENTIALS);
    }
    const match = await this.users.checkPassword(dto.password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException(MSG.BAD_CREDENTIALS);
    }
    await this.users.recordLogin(user.id);
    return this.issueTokens(user.id, user.email, user.fullName, user.roles);
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException(MSG.INVALID_TOKEN);
    }
    const user = await this.users.findById(payload.sub);
    return this.issueTokens(user.id, user.email, user.fullName, user.roles);
  }

  private async issueTokens(
    id: string,
    email: string,
    fullName: string,
    roles: Role[],
  ): Promise<LoginResult> {
    const payload = { sub: id, email, roles };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, this.signOptions('jwt.accessSecret', 'jwt.accessTtl')),
      this.jwt.signAsync({ sub: id }, this.signOptions('jwt.refreshSecret', 'jwt.refreshTtl')),
    ]);
    return { accessToken, refreshToken, user: { id, email, fullName, roles } };
  }

  /**
   * Collects the token signing options. The lifetime comes from configuration so
   * its type is only known at run time, hence the single cast here.
   */
  private signOptions(secretKey: string, keyExpiry: string): JwtSignOptions {
    return {
      secret: this.config.getOrThrow<string>(secretKey),
      expiresIn: this.config.getOrThrow<string>(keyExpiry),
    } as JwtSignOptions;
  }
}
