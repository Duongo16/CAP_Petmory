import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsMongoId, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { PhotoAngle } from '../schemas/pet-photo.schema';

/** The restoration operations the customer can choose. */
export const OPERATIONS = [
  'UPSCALE',
  'SHARPEN',
  'DENOISE',
  'EXPOSURE',
  'CONTRAST',
  'FACE_DETAIL',
  'REMOVE_BACKGROUND',
] as const;

/** Thao tac can mo hinh sua anh (muc 4); cac thao tac con lai chay bang bo loc tai may. */
export const AI_OPERATIONS: readonly string[] = ['FACE_DETAIL', 'REMOVE_BACKGROUND'];

export type RestoreOperation = (typeof OPERATIONS)[number];

export class UploadPhotoDto {
  @IsOptional()
  @IsEnum(PhotoAngle)
  angle?: PhotoAngle;
}

/** Cac thao tac khach chon cho cong cu phuc hoi; gui dang mot gia tri hay nhieu gia tri. */
export class RestoreToolDto {
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : []))
  @IsArray()
  @ArrayMaxSize(7)
  @IsIn(OPERATIONS, { each: true })
  operation?: RestoreOperation[];
}

export class RestoreDto {
  @IsArray()
  @IsIn(OPERATIONS, { each: true })
  operation!: RestoreOperation[];
}

export class ConfirmDto {
  /** True keeps the restored version, false discards it and keeps the original. */
  @IsOptional()
  @IsBoolean()
  accept?: boolean;
}

/** Names the pet a loose picture should join. */
export class AttachPhotoDto {
  @IsMongoId()
  pet!: string;
}
