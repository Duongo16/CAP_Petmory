import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes, createHash } from 'node:crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { MSG } from '../../common/constants/messages';
import { Role } from '../../common/constants/roles';
import { PasswordReset, PasswordResetDocument } from './schemas/password-reset.schema';

/** How long a link to set a new password stays good for. */
const RESET_VALID_MINUTES = 60;

/** How many times one address may ask within that window. */
const RESET_MAX_TRIES = 5;

const MINUTE_MS = 60_000;

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string; roles: Role[]; avatarUrl: string | null };
}

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectModel(PasswordReset.name)
    private readonly resets: Model<PasswordResetDocument>,
  ) {}

  /**
   * Starts the business of setting a new password.
   *
   * The answer is the same whether or not the address belongs to anyone. A
   * different answer would turn this into a way of finding out who has an
   * account here, which is exactly what it must not be.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmailQuietly(email);
    if (!user || !user.active) {
      return;
    }

    const since = new Date(Date.now() - RESET_VALID_MINUTES * MINUTE_MS);
    const tried = await this.resets
      .countDocuments({ owner: user._id, createdAt: { $gte: since } })
      .exec();
    if (tried >= RESET_MAX_TRIES) {
      this.log.warn(`Yeu cau dat lai mat khau vuot muc cho tai khoan ${user._id.toString()}`);
      return;
    }

    const code = randomBytes(32).toString('hex');
    await this.resets.create({
      owner: user._id,
      codeHash: hashOf(code),
      expiresAt: new Date(Date.now() + RESET_VALID_MINUTES * MINUTE_MS),
    });

    /*
     * O muc chay thu, duong dan duoc ghi ra nhat ky may chu thay vi gui thu
     * that: khoan 3.5 Phu luc 01 de viec noi toi dich vu ben ngoai ra ngoai
     * pham vi. Ma dat lai chi xuat hien o day, khong bao gio tra ve cho
     * nguoi goi, vi ai goi cung nhan duoc cung mot cau tra loi.
     */
    this.log.log(`Duong dan dat lai mat khau cho ${user.email}: /reset-password?token=${code}`);
  }

  /**
   * Sets the new password, then clears every other way into the account.
   *
   * Someone asking to reset a password is often someone who fears another
   * person has got in. Leaving the other codes and the open sessions alive
   * would leave that person inside.
   */
  async resetPassword(token: string, password: string): Promise<void> {
    const found = await this.resets
      .findOne({ codeHash: hashOf(token), usedAt: null, expiresAt: { $gt: new Date() } })
      .exec();
    if (!found) {
      throw new BadRequestException('Duong dan dat lai mat khau khong con dung');
    }

    await this.users.setPassword(found.owner.toString(), password);
    found.usedAt = new Date();
    await found.save();

    await this.resets
      .updateMany(
        { owner: found.owner, usedAt: null },
        { $set: { usedAt: new Date(), expiresAt: new Date() } },
      )
      .exec();

    // Moi phien dang mo bi cham dut, ke ca phien cua nguoi da chiem tai khoan.
    await this.users.bumpTokenEpoch(found.owner.toString());
  }

  async register(dto: RegisterDto): Promise<LoginResult> {
    const user = await this.users.createNext(dto);
    return this.issueTokens(user.id, user.email, user.fullName, user.roles, user.avatarUrl ?? null);
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
    return this.issueTokens(user.id, user.email, user.fullName, user.roles, user.avatarUrl ?? null);
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
    return this.issueTokens(user.id, user.email, user.fullName, user.roles, user.avatarUrl ?? null);
  }

  private async issueTokens(
    id: string,
    email: string,
    fullName: string,
    roles: Role[],
    avatarUrl: string | null,
  ): Promise<LoginResult> {
    // The mang theo moc phien, de doi mat khau la moi the cu mat hieu luc.
    const holder = await this.users.findById(id);
    const payload = { sub: id, email, roles, epoch: holder.tokenEpoch };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, this.signOptions('jwt.accessSecret', 'jwt.accessTtl')),
      this.jwt.signAsync({ sub: id }, this.signOptions('jwt.refreshSecret', 'jwt.refreshTtl')),
    ]);
    return { accessToken, refreshToken, user: { id, email, fullName, roles, avatarUrl } };
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

/** The hash kept in place of the code itself. */
function hashOf(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
