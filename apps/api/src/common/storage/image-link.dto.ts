import { IsString, MaxLength, MinLength } from 'class-validator';

/** Duong dan toi mot buc anh tren mang. */
export class ImageLinkDto {
  @IsString() @MinLength(8) @MaxLength(2000)
  url!: string;
}
