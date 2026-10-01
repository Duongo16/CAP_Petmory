import { IsEnum, IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { StoryTone } from '../schemas/pet-story.schema';

/** Xin viet mot cau chuyen moi cho mot be. */
export class WriteStoryDto {
  @IsMongoId()
  petId!: string;

  @IsEnum(StoryTone)
  tone!: StoryTone;

  /** Cac y chu muon dua vao. De trong cung duoc. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/** Xin viet lai tu mot ban da co. */
export class RewriteStoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/** Nguoi dung sua tay mot ban. */
export class EditStoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(6000)
  content!: string;
}

/** Gan mot ban vao mot khoanh khac trong nhat ky. */
export class AttachStoryDto {
  @IsMongoId()
  memoryId!: string;
}
