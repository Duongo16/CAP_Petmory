import {
  IsInt,
  IsNotEmptyObject,
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

/** How many times a feature may be used within one period. */
export class PeriodQuotaDto {
  @IsInt()
  @Min(0)
  @Max(10000)
  day!: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  month!: number;

  @IsInt()
  @Min(0)
  @Max(1000000)
  year!: number;
}

export class AiQuotaDto {
  @ValidateNested()
  @Type(() => PeriodQuotaDto)
  restorePhoto!: PeriodQuotaDto;
}

/**
 * The business settings the Manager group is allowed to change.
 *
 * Every field is declared explicitly rather than accepting the whole config
 * record, so nothing outside this list can be written to the database.
 */
export class UpdateConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  defaultPetProfileLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  qrExpiryHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  estimatedShippingDays?: number;

  @IsOptional()
  @IsInt()
  @Min(200)
  @Max(8000)
  goodShortEdgePx?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(8000)
  warnShortEdgePx?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxPhotoSizeMb?: number;

  /** Below this, the customer is warned that the restoration may have changed the pet. */
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(100)
  minResemblancePercent?: number;

  @IsOptional()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => AiQuotaDto)
  aiQuota?: AiQuotaDto;

  /** Receiving bank identifier: exactly six digits, per the card scheme standard. */
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'Ma ngan hang phai gom dung sau chu so' })
  bankCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  bankName?: string;

  @IsOptional()
  @Matches(/^\d{6,20}$/, { message: 'So tai khoan phai gom tu sau den hai muoi chu so' })
  accountNumber?: string;

  /**
   * Account holder name printed on the payment code. Uppercase unaccented letters,
   * digits and spaces only, because the code format cannot carry Vietnamese accents.
   */
  @IsOptional()
  @Matches(/^[A-Z0-9 ]{2,100}$/, {
    message: 'Ten chu tai khoan chi gom chu in hoa khong dau, chu so va khoang trang',
  })
  accountHolder?: string;
}
