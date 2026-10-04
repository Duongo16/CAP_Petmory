import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

/**
 * Mot giao dich SePay bao ve, theo dung tai lieu webhook cua SePay.
 *
 * Chi kiem nhung truong he thong dung toi. SePay co the them truong moi bat ky
 * luc nao, nen phan kiem nay khong tu choi truong la; ban goc van duoc luu
 * nguyen vao nhat ky de doi soat.
 */
export class SePayNotificationDto {
  /** Ma giao dich cua SePay, dung de chan xu ly trung. SePay gui so, API doi soat gui chuoi. */
  @Transform(({ value }) => (value === undefined || value === null ? '' : String(value)))
  @Matches(/^[A-Za-z0-9_.-]{1,64}$/, { message: 'Ma giao dich khong hop le' })
  id!: string;

  /** So tien, la so nguyen dong. */
  @IsInt({ message: 'So tien phai la so nguyen' })
  @Min(0)
  transferAmount!: number;

  /** Tien vao hay tien ra. Chi tien vao moi duoc ghi nhan cho don. */
  @IsOptional()
  @IsIn(['in', 'out'])
  transferType?: 'in' | 'out';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** Ma thanh toan SePay tu nhan ra theo tien to da cau hinh. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  code?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  gateway?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subAccount?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  transactionDate?: string;
}

/** Yeu cau doi soat voi SePay: lay giao dich bao nhieu ngay gan nhat. */
export class ReconcileDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  days?: number;
}
