import { IsArray, IsBoolean, IsEnum, IsIn, IsOptional } from 'class-validator';
import { PhotoAngle } from '../schemas/pet-photo.schema';

/** The restoration operations the customer can choose. */
export const OPERATIONS = [
  'UPSCALE',
  'SHARPEN',
  'DENOISE',
  'EXPOSURE',
  'CONTRAST',
] as const;

export type RestoreOperation = (typeof OPERATIONS)[number];

export class UploadPhotoDto {
  @IsEnum(PhotoAngle)
  angle!: PhotoAngle;
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
