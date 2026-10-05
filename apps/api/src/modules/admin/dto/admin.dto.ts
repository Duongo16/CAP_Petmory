import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../../orders/schemas/order.schema';

export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 100;

export class OrderFilterDto {
  /** Accepts only the declared statuses, never a free-form string. */
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_SIZE_MAX)
  pageSize?: number;
}

export class ChangeStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  /** Doi trang thai bang tay phai ghi ly do (muc 10), de doi soat lai ve sau. */
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason!: string;
}

/** Bo co can xu ly tren don, kem ghi chu da xu ly the nao. */
export class ClearAttentionDto {
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  note!: string;
}

export class CustomerSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_SIZE_MAX)
  pageSize?: number;
}

/** Mot muc tren phieu kiem tra chat luong duoc tich hay bo tich. */
export class QualityTickDto {
  @IsBoolean()
  done!: boolean;
}
