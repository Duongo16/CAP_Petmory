import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class WriteReviewDto {
  @Matches(/^[A-Za-z0-9_-]{1,40}$/, { message: 'Ma san pham khong hop le' })
  productTypeCode!: string;

  @Matches(/^[A-Za-z0-9]{1,30}$/, { message: 'Ma don hang khong hop le' })
  orderCode!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Nhan xet toi da 1000 ky tu' })
  comment?: string;
}
