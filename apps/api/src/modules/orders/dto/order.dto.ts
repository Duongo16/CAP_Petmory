import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateOrderDto {
  @IsString() @MinLength(2) @MaxLength(100)
  fullName!: string;

  /** Vietnamese phone number: starts with 0 and has 10 digits. */
  @Matches(/^0\d{9}$/, { message: 'So dien thoai khong dung dinh dang' })
  phone!: string;

  @IsString() @MinLength(5) @MaxLength(250)
  address!: string;

  @IsString() @MinLength(2) @MaxLength(100)
  province!: string;

  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}
