import { IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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
