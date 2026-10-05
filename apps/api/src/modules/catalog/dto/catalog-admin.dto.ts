import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PackagingKind } from '../schemas/packaging-option.schema';

/** Gia la so nguyen dong, khong co phan le, khong am. */
const WHOLE_DONG = /^\d{1,12}$/;
const MONEY_MESSAGE = 'Gia phai la so nguyen dong';
const CODE_SHAPE = /^[A-Z0-9-]{2,30}$/;
const CODE_MESSAGE = 'Ma chi gom chu in hoa, chu so va dau gach ngang';

/** Them mot loai san pham. Kich co them rieng sau. */
export class CreateProductTypeDto {
  @Matches(CODE_SHAPE, { message: CODE_MESSAGE })
  code!: string;

  @IsString() @MinLength(2) @MaxLength(120)
  name!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(200)
  material?: string;

  @IsOptional() @IsString() @MaxLength(500)
  imageUrl?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;
}

export class UpdateProductTypeDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  name?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(200)
  material?: string;

  @IsOptional() @IsString() @MaxLength(500)
  imageUrl?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;
}

/** Mot kich co: mo ta, anh, gia, so ngay lam, so anh toi thieu, so phu kien toi da (muc 12). */
export class CreateProductSizeDto {
  @Matches(CODE_SHAPE, { message: CODE_MESSAGE })
  code!: string;

  @IsString() @MinLength(1) @MaxLength(80)
  displayName!: string;

  @IsString() @MinLength(1) @MaxLength(80)
  dimensions!: string;

  @IsString() @MinLength(1) @MaxLength(300)
  explainer!: string;

  @Matches(WHOLE_DONG, { message: MONEY_MESSAGE })
  price!: string;

  @IsInt() @Min(1) @Max(120)
  productionDays!: number;

  @IsOptional() @IsInt() @Min(1) @Max(20)
  minPhotos?: number;

  @IsOptional() @IsInt() @Min(0) @Max(4)
  maxAccessories?: number;

  @IsOptional() @IsString() @MaxLength(500)
  imageUrl?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;
}

export class UpdateProductSizeDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80)
  displayName?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(80)
  dimensions?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(300)
  explainer?: string;

  @IsOptional() @Matches(WHOLE_DONG, { message: MONEY_MESSAGE })
  price?: string;

  @IsOptional() @IsInt() @Min(1) @Max(120)
  productionDays?: number;

  @IsOptional() @IsInt() @Min(1) @Max(20)
  minPhotos?: number;

  @IsOptional() @IsInt() @Min(0) @Max(4)
  maxAccessories?: number;

  @IsOptional() @IsString() @MaxLength(500)
  imageUrl?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;
}

/** De trung bay. */
export class CreateDisplayBaseDto {
  @Matches(CODE_SHAPE, { message: CODE_MESSAGE })
  code!: string;

  @IsString() @MinLength(2) @MaxLength(120)
  displayName!: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @Matches(WHOLE_DONG, { message: MONEY_MESSAGE })
  priceDelta!: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;
}

export class UpdateDisplayBaseDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  displayName?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @Matches(WHOLE_DONG, { message: MONEY_MESSAGE })
  priceDelta?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;
}

/** Hop hoac khung. */
export class CreatePackagingDto {
  @IsEnum(PackagingKind)
  kind!: PackagingKind;

  @Matches(CODE_SHAPE, { message: CODE_MESSAGE })
  code!: string;

  @IsString() @MinLength(2) @MaxLength(120)
  displayName!: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @Matches(WHOLE_DONG, { message: MONEY_MESSAGE })
  priceDelta!: string;

  @IsOptional() @IsString() @MaxLength(500)
  imageUrl?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;
}

export class UpdatePackagingDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  displayName?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @Matches(WHOLE_DONG, { message: MONEY_MESSAGE })
  priceDelta?: string;

  @IsOptional() @IsString() @MaxLength(500)
  imageUrl?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;
}
