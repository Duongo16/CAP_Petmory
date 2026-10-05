import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AccessoryAnchor } from '../schemas/accessory.schema';

/** Gia la so nguyen dong, khong co phan le, khong am. */
const WHOLE_DONG = /^\d{1,12}$/;
const CODE_SHAPE = /^[A-Z0-9-]{2,30}$/;
/** Chi ten tep mo hinh trong thu muc mo hinh, khong cho duong dan. */
const MODEL_FILE = /^[a-z0-9-]{2,70}\.glb$/;

export class CreateAccessoryDto {
  @Matches(CODE_SHAPE, { message: 'Ma chi gom chu in hoa, chu so va dau gach ngang' })
  code!: string;

  @IsString() @MinLength(2) @MaxLength(120)
  displayName!: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsEnum(AccessoryAnchor)
  anchor!: AccessoryAnchor;

  @Matches(MODEL_FILE, { message: 'Ten tep mo hinh khong hop le' })
  modelFile!: string;

  @Matches(WHOLE_DONG, { message: 'Gia phai la so nguyen dong' })
  priceDelta!: string;

  @IsOptional() @IsString() @MaxLength(500)
  imageUrl?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;
}

export class UpdateAccessoryDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  displayName?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsEnum(AccessoryAnchor)
  anchor?: AccessoryAnchor;

  @IsOptional() @Matches(MODEL_FILE, { message: 'Ten tep mo hinh khong hop le' })
  modelFile?: string;

  @IsOptional() @Matches(WHOLE_DONG, { message: 'Gia phai la so nguyen dong' })
  priceDelta?: string;

  @IsOptional() @IsString() @MaxLength(500)
  imageUrl?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;
}
