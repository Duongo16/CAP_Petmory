import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsMongoId,
  IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MemoryTopic } from '../schemas/memory.schema';

/** Cac kieu giay cua mot trang so. Danh sach dong, khong nhan gi khac. */
export const PAPER_KINDS = ['CREAM', 'KRAFT', 'DOT', 'LINE', 'GRID', 'BLOOM'];

/** Bo hinh trang tri co san. Nguoi dung khong tai hinh rieng len duoc. */
export const STICKER_CODES = [
  'heart', 'paw', 'star', 'bone', 'fish', 'leaf',
  'cloud', 'sun', 'tape', 'flower', 'ball', 'moon',
];

/** Ba kieu chu cho o chu tren trang. */
export const FONT_KEYS = ['HAND', 'BODY', 'SERIF'];

/** Nhieu nhat bao nhieu mon do dat duoc len mot trang. */
const DECOR_MAX = 40;

/**
 * Mot mon do dat len trang so: o chu, buc anh, hoac hinh trang tri.
 *
 * Vi tri ghi theo phan tram cua trang, de trang bay ra man hinh nao hay in
 * ra giay kho nao thi moi thu van nam dung cho cu.
 */
export class DecorItemDto {
  @IsIn(['TEXT', 'PHOTO', 'STICKER'])
  kind!: string;

  @IsNumber() @Min(-20) @Max(120)
  x!: number;

  @IsNumber() @Min(-20) @Max(120)
  y!: number;

  @IsNumber() @Min(4) @Max(100)
  width!: number;

  @IsOptional() @IsNumber() @Min(-45) @Max(45)
  rotate?: number;

  @IsOptional() @IsInt() @Min(0) @Max(200)
  z?: number;

  @IsOptional() @IsString() @MaxLength(600)
  text?: string;

  @IsOptional() @IsMongoId()
  photo?: string;

  @IsOptional() @IsIn(STICKER_CODES)
  sticker?: string;

  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Mau phai la ma sau chu so' })
  color?: string;

  @IsOptional() @IsIn(FONT_KEYS)
  fontKey?: string;
}

export class CreateMemoryDto {
  @IsMongoId()
  pet!: string;

  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

  @IsOptional() @IsString() @MaxLength(4000)
  body?: string;

  @IsDateString()
  happenedAt!: string;

  @IsOptional() @IsString() @MaxLength(200)
  place?: string;

  @IsOptional() @IsEnum(MemoryTopic)
  topic?: MemoryTopic;

  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true })
  @MaxLength(40, { each: true })
  tag?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsMongoId({ each: true })
  photo?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(DECOR_MAX)
  @ValidateNested({ each: true }) @Type(() => DecorItemDto)
  decor?: DecorItemDto[];

  @IsOptional() @IsIn(PAPER_KINDS)
  paper?: string;

  @IsOptional() @IsBoolean()
  isMilestone?: boolean;
}

export class UpdateMemoryDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(4000)
  body?: string;

  @IsOptional() @IsDateString()
  happenedAt?: string;

  @IsOptional() @IsString() @MaxLength(200)
  place?: string;

  @IsOptional() @IsEnum(MemoryTopic)
  topic?: MemoryTopic;

  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true })
  @MaxLength(40, { each: true })
  tag?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsMongoId({ each: true })
  photo?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(DECOR_MAX)
  @ValidateNested({ each: true }) @Type(() => DecorItemDto)
  decor?: DecorItemDto[];

  @IsOptional() @IsIn(PAPER_KINDS)
  paper?: string;

  @IsOptional() @IsBoolean()
  isMilestone?: boolean;
}
