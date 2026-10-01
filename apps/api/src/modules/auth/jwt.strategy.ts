import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/constants/roles';
import { UsersService } from '../users/users.service';
import { MSG } from '../../common/constants/messages';

interface JwtPayload {
  sub: string;
  email: string;
  roles: Role[];
  /** The session mark the account carried when this token was issued. */
  epoch?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  /**
   * Cung voi viec kiem chu ky, moc phien cua the duoc doi chieu voi moc dang
   * luu cua tai khoan. Doi mat khau lam moc tang len, nen nhung the phat
   * truoc do het hieu luc ngay, khong phai doi den luc chung tu het han.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findById(payload.sub).catch(() => null);
    if (!user || !user.active) {
      throw new UnauthorizedException(MSG.INVALID_TOKEN);
    }
    if ((payload.epoch ?? 1) !== user.tokenEpoch) {
      throw new UnauthorizedException(MSG.INVALID_TOKEN);
    }
    return { userId: payload.sub, email: payload.email, roles: payload.roles };
  }
}
