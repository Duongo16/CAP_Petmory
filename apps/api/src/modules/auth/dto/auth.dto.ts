import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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
  @Matches(/^0[0-9]{9}$/, { message: 'So dien thoai phai gom 10 chu so va bat dau bang 0' })
  phone?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Email khong dung dinh dang' })
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
