import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { KnowledgeTopic } from '../schemas/assistant-knowledge.schema';

/** Duong dan noi bo: bat dau bang dau gach cheo, khong dan ra trang ngoai. */
const INSIDE_LINK = /^(\/[A-Za-z0-9\-_/?=&.]*)?$/;

export class KnowledgeDto {
  @Matches(/^[A-Za-z0-9_-]{2,40}$/, { message: 'Ma chi gom chu, so, gach ngang, 2 den 40 ky tu' })
  code!: string;

  @IsString() @MinLength(3) @MaxLength(160)
  question!: string;

  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(60, { each: true })
  keywords!: string[];

  @IsString() @MinLength(3) @MaxLength(2000)
  answer!: string;

  @IsOptional() @Matches(INSIDE_LINK, { message: 'Duong dan phai la duong dan trong trang, bat dau bang /' })
  link?: string;

  @IsOptional() @IsEnum(KnowledgeTopic)
  topic?: KnowledgeTopic;

  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true })
  followUp?: string[];

  @IsOptional() @IsBoolean()
  starter?: boolean;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;
}

export class UpdateKnowledgeDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(160)
  question?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(60, { each: true })
  keywords?: string[];

  @IsOptional() @IsString() @MinLength(3) @MaxLength(2000)
  answer?: string;

  @IsOptional() @Matches(INSIDE_LINK, { message: 'Duong dan phai la duong dan trong trang, bat dau bang /' })
  link?: string;

  @IsOptional() @IsEnum(KnowledgeTopic)
  topic?: KnowledgeTopic;

  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true })
  followUp?: string[];

  @IsOptional() @IsBoolean()
  starter?: boolean;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;
}
