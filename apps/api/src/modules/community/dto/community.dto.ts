import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsMongoId, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { PostTopic } from '../schemas/post.schema';

const TAG_PATTERN = /^[\p{L}\p{N} _-]{1,30}$/u;

export class WritePostDto {
  @IsEnum(PostTopic, { message: 'Chu de khong hop le' })
  topic!: PostTopic;

  @IsString()
  @MinLength(1)
  @MaxLength(200, { message: 'Tieu de toi da 200 ky tu' })
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000, { message: 'Noi dung toi da 5000 ky tu' })
  content!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6, { message: 'Toi da 6 the chu de' })
  @Matches(TAG_PATTERN, { each: true, message: 'The chu de khong hop le' })
  tags?: string[];

  /** The author's own pet. Ownership is checked in the service. */
  @IsOptional()
  @IsMongoId()
  petId?: string;
}

export class WriteCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000, { message: 'Binh luan toi da 2000 ky tu' })
  content!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fullName?: string;

  /** Rong la bo so; neu co thi 10 chu so bat dau bang 0, giong luc dang ky. */
  @IsOptional()
  @IsString()
  @Matches(/^(0\d{9})?$/, { message: 'So dien thoai phai gom 10 chu so va bat dau bang 0' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}

export class FeedQueryDto {
  @IsOptional()
  @IsEnum(PostTopic, { message: 'Chu de khong hop le' })
  topic?: PostTopic;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  keyword?: string;

  /** Restricts the feed to the people the caller follows. */
  @IsOptional()
  @IsString()
  @Matches(/^(ALL|FOLLOWING|SAVED|LIKED)$/, { message: 'Bo loc khong hop le' })
  scope?: 'ALL' | 'FOLLOWING' | 'SAVED' | 'LIKED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
