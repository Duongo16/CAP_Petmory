import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ColorGroup } from '../schemas/color-code.schema';

/** Six hexadecimal characters with a leading hash, the only form the viewer reads. */
const SWATCH = /^#[0-9a-fA-F]{6}$/;

export class CreateColorCodeDto {
  @Matches(/^[A-Za-z0-9-]{2,30}$/, { message: 'Ma mau chi gom chu, so va dau gach ngang' })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80, { message: 'Ten hien thi toi da 80 ky tu' })
  displayName!: string;

  @Matches(SWATCH, { message: 'O mau phai co dang #RRGGBB' })
  swatch!: string;

  @IsEnum(ColorGroup, { message: 'Nhom mau khong hop le' })
  group!: ColorGroup;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * Everything a manager may change on an existing colour. The code itself is not
 * here: it is the bridge to a real wool roll in the store, so renaming it would
 * break the orders already placed against it.
 */
export class UpdateColorCodeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80, { message: 'Ten hien thi toi da 80 ky tu' })
  displayName?: string;

  @IsOptional()
  @Matches(SWATCH, { message: 'O mau phai co dang #RRGGBB' })
  swatch?: string;

  @IsOptional()
  @IsEnum(ColorGroup, { message: 'Nhom mau khong hop le' })
  group?: ColorGroup;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
