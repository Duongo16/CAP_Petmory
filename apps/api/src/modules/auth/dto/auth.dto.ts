import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

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
}

export class LoginDto {
  @IsEmail({}, { message: 'Email khong dung dinh dang' })
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
