import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PreviewAngle,
  STAND_DECORATION_MAX,
  StandDecoration,
  StandTone,
} from '../schemas/design.schema';

/** Caps how many faces one mesh may carry, so a record cannot balloon. */
export const COUNT_FACE_MAX = 20000;

/** Bon diem neo nen mot mau gan nhieu nhat bon phu kien. */
export const ACCESSORY_PICK_MAX = 4;
export const COUNT_MESH_MAX = 30;
export const COUNT_DESIGN_MAX = 30;

/** Sau vung co ten cua mot mo hinh, dung nhu hop dong ghi. */
export const ZONE_NAMES = ['MAIN_FUR', 'BELLY_FUR', 'EAR', 'TAIL', 'EYE', 'NOSE'];

/** Mau cua mot vung co ten. */
export class ZonePaintDto {
  @IsIn(ZONE_NAMES)
  zone!: string;

  @Matches(/^[A-Z0-9-]{1,20}$/)
  colorCode!: string;
}

export class MeshPaintDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  mesh!: string;

  /**
   * The colour string for a whole mesh: every six hex characters is one face.
   * Its length must divide by six, otherwise the data is corrupt.
   */
  @Matches(/^(?:[0-9a-f]{6})*$/, {
    message: 'Chuoi mau phai gom cac nhom sau ky tu he muoi sau viet thuong',
  })
  @MaxLength(COUNT_FACE_MAX * 6)
  color!: string;
}

export class EngravingDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsDateString()
  memorialDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  message?: string;
}

/** De trung bay: ma de trong danh muc, mau go va do trang tri, deu theo danh sach co san. */
export class StandDto {
  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{0,40}$/)
  baseCode?: string;

  @IsOptional()
  @IsEnum(StandTone)
  tone?: StandTone;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(STAND_DECORATION_MAX)
  @ArrayUnique()
  @IsEnum(StandDecoration, { each: true })
  decorations?: StandDecoration[];
}

export class SaveDesignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  /**
   * Base model code. Letters, digits, hyphen and underscore only, so nobody can
   * smuggle a file path in here.
   */
  @Matches(/^[A-Za-z0-9_-]{1,60}$/, { message: 'Ma mo hinh khong hop le' })
  modelCode!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(COUNT_MESH_MAX)
  @ValidateNested({ each: true })
  @Type(() => MeshPaintDto)
  paint?: MeshPaintDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @Matches(/^[A-Z0-9-]{1,20}$/, { each: true })
  colorCodesUsed?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ZonePaintDto)
  zonePaint?: ZonePaintDto[];

  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{0,40}$/)
  productTypeCode?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{0,40}$/)
  sizeCode?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EngravingDto)
  engraving?: EngravingDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => StandDto)
  stand?: StandDto;

  @IsOptional()
  @IsMongoId()
  pet?: string;

  /** Ma phu kien gan len mau, moi diem neo mot mon. May chu doc gia va kiem lai. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ACCESSORY_PICK_MAX)
  @ArrayUnique()
  @Matches(/^[A-Za-z0-9-]{2,30}$/, { each: true, message: 'Ma phu kien khong hop le' })
  accessories?: string[];

  /** Dac diem rieng cua be ma xuong can biet (vet lang, dom long...), khach tu ghi. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  featureNote?: string;
}

/** Doi ten mot ban thiet ke. */
export class RenameDesignDto {
  @IsString()
  @MaxLength(100)
  @Matches(/\S/, { message: 'Ten ban thiet ke khong duoc de trong' })
  name!: string;
}

export class UploadPreviewDto {
  @IsEnum(PreviewAngle)
  angle!: PreviewAngle;
}
