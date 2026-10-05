import { IsEnum, IsMongoId, IsString, Matches, MaxLength } from 'class-validator';
import { SuggestStyle } from '../schemas/design-suggestion.schema';

/** Dung san mot mau tu anh cua mot be. */
export class MatchFromPhotoDto {
  @IsMongoId()
  petId!: string;
}

/** Xin mot bo phuong an thiet ke cho mot be. */
export class AskSuggestionDto {
  @IsMongoId()
  petId!: string;

  /**
   * Phong cach mau.
   *
   * Nhan dung mot trong cac gia tri da khai chu khong nhan chu tu do, de mot
   * gia tri la khong the di thang vao loi dan gui cho dich vu ben ngoai.
   */
  @IsEnum(SuggestStyle)
  style!: SuggestStyle;
}

/** Chon mot phuong an trong bo da nhan. */
export class ChooseOptionDto {
  @IsString()
  @MaxLength(20)
  @Matches(/^P[1-9][0-9]?$/, { message: 'Ma phuong an khong dung dang' })
  optionKey!: string;
}
