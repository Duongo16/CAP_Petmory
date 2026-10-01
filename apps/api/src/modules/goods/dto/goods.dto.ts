import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Gia ban la so nguyen dong.
 *
 * Toan he thong tinh tien bang dong chan, khong co hao. Nhan mot so le o day
 * se de lai mot khoan le khong ai cong duoc cho khop, nen chan ngay tai bien.
 */
const WHOLE_DONG = /^\d{1,12}$/;
const WHOLE_DONG_MESSAGE = 'Gia phai la so nguyen dong, khong co phan le';

/** Ma hang va ma to hop: chu in, chu so va dau gach ngang. */
const CODE_SHAPE = /^[A-Z0-9-]{2,40}$/;
const CODE_MESSAGE = 'Ma chi gom chu in hoa, chu so va dau gach ngang';

export class GoodsCategoryDto {
  @Matches(CODE_SHAPE, { message: CODE_MESSAGE })
  code!: string;

  @IsString() @MinLength(2) @MaxLength(120)
  name!: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  enabled?: boolean;
}

export class UpdateGoodsCategoryDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  name?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  enabled?: boolean;
}

/** Mot to hop bien the khi tao hoac sua mon hang. */
export class GoodsVariantDto {
  @Matches(CODE_SHAPE, { message: CODE_MESSAGE })
  sku!: string;

  @IsArray() @ArrayMaxSize(2) @IsString({ each: true })
  @MaxLength(60, { each: true })
  optionValues!: string[];

  @Matches(WHOLE_DONG, { message: WHOLE_DONG_MESSAGE })
  price!: string;

  @IsOptional() @IsInt() @Min(0) @Max(1_000_000)
  stock?: number;

  @IsOptional() @IsBoolean()
  enabled?: boolean;
}

export class CreateGoodsDto {
  @Matches(CODE_SHAPE, { message: CODE_MESSAGE })
  code!: string;

  @IsString() @MinLength(2) @MaxLength(200)
  name!: string;

  @IsMongoId()
  category!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true })
  @MaxLength(500, { each: true })
  images?: string[];

  /** Toi da hai thuoc tinh bien the, dung nhu muc 23 khoan 2 ghi. */
  @IsOptional() @IsArray() @ArrayMaxSize(2) @IsString({ each: true })
  @MaxLength(60, { each: true })
  optionNames?: string[];

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(60)
  @ValidateNested({ each: true }) @Type(() => GoodsVariantDto)
  variant!: GoodsVariantDto[];

  @IsOptional() @IsInt() @Min(1) @Max(60)
  deliveryDays?: number;

  @IsOptional() @IsBoolean()
  enabled?: boolean;
}

export class UpdateGoodsDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200)
  name?: string;

  @IsOptional() @IsMongoId()
  category?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true })
  @MaxLength(500, { each: true })
  images?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(2) @IsString({ each: true })
  @MaxLength(60, { each: true })
  optionNames?: string[];

  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(60)
  @ValidateNested({ each: true }) @Type(() => GoodsVariantDto)
  variant?: GoodsVariantDto[];

  @IsOptional() @IsInt() @Min(1) @Max(60)
  deliveryDays?: number;

  @IsOptional() @IsBoolean()
  enabled?: boolean;
}

/**
 * Mot lan dieu chinh ton kho bang tay.
 *
 * Ly do la bat buoc: mot con so ton kho doi ma khong ai biet vi sao thi lan
 * sau khong ai doi soat duoc voi so hang thuc te trong kho.
 */
export class StockAdjustDto {
  @IsInt() @Min(-1_000_000) @Max(1_000_000)
  delta!: number;

  @IsString() @MinLength(5) @MaxLength(300)
  note!: string;
}

/** Bo loc cua trang khach. */
export class GoodsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @IsString() @MaxLength(40)
  category?: string;

  @IsOptional() @IsString() @MaxLength(80)
  keyword?: string;

  /** Sap xep: moi nhat, gia tang dan, hoac gia giam dan. */
  @IsOptional() @IsString() @MaxLength(20)
  sort?: string;
}
