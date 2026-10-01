import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MemoryTopic } from '../schemas/memory.schema';

/** Bat hoac tat che do cong khai cho ca quyen nhat ky cua mot be. */
export class DiaryPrivacyDto {
  @IsBoolean()
  isPublic!: boolean;
}

/** Tao mot duong dan chia se. De trong ngay het han nghia la khong het han. */
export class MakeShareDto {
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

/** Bo loc cua trang cong dong. */
export class PublicDiaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsEnum(MemoryTopic)
  topic?: MemoryTopic;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  keyword?: string;
}

/** Ly do quan tri vien an mot quyen khoi cong dong. Bat buoc phai co. */
export class HideDiaryDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

/** Ba kieu chuyen canh hop dong yeu cau, viet ra day du de khong nhan gi khac. */
export const SLIDE_EFFECTS = ['FADE', 'SLIDE', 'ZOOM'];

/** Cach trinh chieu mot quyen nhat ky. */
export class SlideSettingDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  trackCode?: string;

  @IsOptional()
  @IsIn(SLIDE_EFFECTS)
  effect?: string;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(10)
  seconds?: number;
}

/** Khoang thoi gian muon xuat. De trong ca hai la lay ca quyen. */
export class ExportDiaryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
