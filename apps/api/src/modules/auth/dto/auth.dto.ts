import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  normalizeVietnamesePhone,
  VIETNAMESE_PHONE,
} from '../../../common/validation/vietnamese-phone';

export class RegisterDto {
  @IsEmail({}, { message: 'Email khong dung dinh dang' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Mat khau toi thieu 8 ky tu' })
  @MaxLength(72, { message: 'Mat khau toi da 72 ky tu' })
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    return normalizeVietnamesePhone(value) || undefined;
  })
  @Matches(VIETNAMESE_PHONE, {
    message: 'So dien thoai phai gom 10 chu so va bat dau bang 0',
  })
  phone?: string;
}

export class LoginDto {
  @IsString()
  @MinLength(1, { message: 'Hay nhap email hoac so dien thoai' })
  @Matches(/^(?:[^@\s]+@[^@\s]+\.[^@\s]+|\+?84\d{9}|0\d{9})$/, {
    message: 'Email hoac so dien thoai khong dung dinh dang',
  })
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Email khong dung dinh dang' })
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Mat khau toi thieu 8 ky tu' })
  @MaxLength(72, { message: 'Mat khau toi da 72 ky tu' })
  password!: string;
}

/** Doi mat khau khi dang dang nhap: phai nhap dung mat khau cu. */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'Mat khau toi thieu 8 ky tu' })
  @MaxLength(72, { message: 'Mat khau toi da 72 ky tu' })
  newPassword!: string;
}
