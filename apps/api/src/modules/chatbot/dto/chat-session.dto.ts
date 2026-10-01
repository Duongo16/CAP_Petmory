import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Mot cau khach go trong phien. */
export class SessionAskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  question!: string;
}

/** Khach xin gap nguoi that. */
export class HandoverDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Nhan vien tra loi mot phien. */
export class StaffReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;
}
