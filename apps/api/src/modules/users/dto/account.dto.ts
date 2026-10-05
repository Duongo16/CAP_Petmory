import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '../../../common/constants/roles';

/**
 * Cac nhom quyen mot tai khoan duoc gan.
 *
 * Khai ra day du thay vi nhan chuoi tu do, de khong ai gan duoc mot nhom quyen
 * khong ton tai bang cach go thang vao yeu cau.
 */
export const ROLE_NAMES: string[] = [Role.MANAGER, Role.SUPPORT, Role.CUSTOMER];

/** Do dai mat khau toi thieu, giu bang cho dang ky thuong. */
const PASSWORD_MIN = 8;

/** Tim va phan trang danh sach tai khoan. */
export class AccountQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  keyword?: string;

  @IsOptional()
  @IsIn(ROLE_NAMES)
  role?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

/** Tao mot tai khoan moi. */
export class CreateAccountDto {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(100)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsIn(ROLE_NAMES)
  role!: string;
}

/**
 * Doi nhom quyen cua mot tai khoan.
 *
 * Moi tai khoan mang dung mot nhom. Cho mot nguoi vua o nhom Quan ly vua o
 * nhom Quan tri vien thi viec tach trach nhiem khong con y nghia gi.
 */
export class ChangeRoleDto {
  @IsIn(ROLE_NAMES)
  role!: string;
}

/** Bat hoac tat mot tai khoan. */
export class SetActiveDto {
  @IsBoolean()
  active!: boolean;
}

/** Dat lai mat khau cho mot tai khoan. */
export class ResetPasswordDto {
  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(100)
  password!: string;
}

/** Dat rieng gioi han so ho so thu cung cho mot tai khoan. */
export class SetPetLimitDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  petProfileLimit?: number;
}
