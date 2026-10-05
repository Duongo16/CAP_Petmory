import { ArrayMaxSize, IsArray, IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AddToCartDto {
  @IsString()
  @MaxLength(40)
  productTypeCode!: string;

  @IsString()
  @MaxLength(40)
  sizeCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  petName?: string;

  @IsOptional()
  @IsMongoId()
  designId?: string;

  /** Optional stand. Left out, the figure is sold without one. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  displayBaseCode?: string;

  /** Hop va khung chon them, moi loai mot mau. De trong la khong lay. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  packagingCodes?: string[];

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

/**
 * Them mot mon hang co san vao gio.
 *
 * Duong rieng voi hang tuy bien, vi hai dong hang can hai bo du lieu khac
 * han nhau va gop chung mot duong se sinh ra mot mo o de trong.
 */
export class AddGoodsDto {
  @IsString()
  @MaxLength(40)
  goodsCode!: string;

  @IsString()
  @MaxLength(40)
  sku!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class ChangeQuantityDto {
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}
