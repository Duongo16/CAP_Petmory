import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Mot giao dich trong API giao dich cua SePay. So tien la chuoi co hai so le. */
export interface SePayTransaction {
  id: string;
  bank_brand_name: string;
  account_number: string;
  transaction_date: string;
  amount_out: string;
  amount_in: string;
  accumulated: string;
  transaction_content: string;
  reference_number: string;
  code: string | null;
  sub_account: string | null;
}

/**
 * Loi phia SePay. Dung ma 424 thay vi 5xx, vi bo loc loi chung giau noi dung
 * moi loi 5xx, ma nguoi bam doi soat can biet ly do that de xu ly.
 */
function sepayFailure(message: string): HttpException {
  return new HttpException(message, HttpStatus.FAILED_DEPENDENCY);
}

interface ListResponse {
  status: number;
  error: unknown;
  messages?: { success?: boolean };
  transactions?: SePayTransaction[];
}

/**
 * Goi API giao dich cua SePay de doi soat.
 *
 * Chi doc, khong ghi gi ben SePay. Moi lan goi co gioi han thoi gian, va khong
 * tu thu lai: SePay chi cho ba lan goi moi giay, nen goi lai ngay se de bi chan
 * them. Nguoi bam doi soat se thay loi va bam lai sau.
 */
@Injectable()
export class SePayClient {
  private readonly logger = new Logger(SePayClient.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>('sepay.apiToken'));
  }

  /** Giao dich cua mot tai khoan tu mot ngay tro di, ngay theo dang nam-thang-ngay. */
  async listTransactions(accountNumber: string, sinceDate: string): Promise<SePayTransaction[]> {
    const token = this.config.get<string>('sepay.apiToken');
    if (!token) {
      throw sepayFailure('Chua cau hinh SEPAY_API_TOKEN nen chua doi soat duoc');
    }
    const base = this.config.get<string>('sepay.apiBase');
    const timeoutMs = this.config.get<number>('sepay.timeoutMs') ?? 10000;
    const url = new URL(`${base}/transactions/list`);
    url.searchParams.set('account_number', accountNumber);
    url.searchParams.set('transaction_date_min', sinceDate);
    url.searchParams.set('limit', '5000');

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (trouble) {
      const why = trouble instanceof Error ? trouble.name : 'loi mang';
      this.logger.warn(`Goi SePay that bai: ${why}`);
      throw sepayFailure('Khong ket noi duoc SePay, hay thu lai sau');
    }
    if (response.status === 429) {
      const wait = response.headers.get('x-sepay-userapi-retry-after') ?? '1';
      throw sepayFailure(`SePay dang gioi han so lan goi, thu lai sau ${wait} giay`);
    }
    if (!response.ok) {
      this.logger.warn(`SePay tra ve ma ${response.status}`);
      throw sepayFailure(`SePay tra ve loi ${response.status}`);
    }
    const body = (await response.json()) as ListResponse;
    if (body.status !== 200 || body.messages?.success !== true) {
      throw sepayFailure('SePay tra ve ket qua khong thanh cong');
    }
    return body.transactions ?? [];
  }
}
