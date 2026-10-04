/**
 * Tim ma don trong noi dung chuyen khoan.
 *
 * Ma don co dang PM, sau do sau chu so ngay va so thu tu trong ngay. So thu tu
 * thuong co ba chu so, nhung tu don thu 1000 trong ngay thi co bon. Ngan hang
 * hay tu chen them chu so ngay sau noi dung, nen khong the lay het day so lien
 * nhau ma phai thu ca hai do dai, dai truoc, va de may chu doi chieu xem ma nao
 * co that.
 */

/** Tien to cua ma don. */
export const REFERENCE_PREFIX = 'PM';

/** Sau chu so ngay cong voi ba hoac bon chu so thu tu. */
const DIGITS_SHORT = 9;
const DIGITS_LONG = 10;

/**
 * Cac ma don co the nam trong mot giao dich, theo thu tu nen thu.
 *
 * Ma thanh toan SePay tu nhan ra duoc dat len dau, vi do la ma theo dung cau
 * hinh tien to tren SePay. Sau do toi cac ma tim thay trong noi dung.
 */
export function candidateReferences(content: string, sepayCode?: string | null): string[] {
  const out: string[] = [];
  const push = (one: string): void => {
    if (!out.includes(one)) {
      out.push(one);
    }
  };
  const code = (sepayCode ?? '').toUpperCase().replace(/\s+/g, '');
  for (const one of scan(code)) {
    push(one);
  }
  for (const one of scan(content.toUpperCase())) {
    push(one);
  }
  return out;
}

function scan(text: string): string[] {
  const found: string[] = [];
  const pattern = new RegExp(`${REFERENCE_PREFIX}(\\d{${DIGITS_SHORT},})`, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const digits = match[1];
    if (digits.length >= DIGITS_LONG) {
      found.push(REFERENCE_PREFIX + digits.slice(0, DIGITS_LONG));
    }
    found.push(REFERENCE_PREFIX + digits.slice(0, DIGITS_SHORT));
  }
  return found;
}

/**
 * Doc so tien chuyen khoan thanh so nguyen dong.
 *
 * Tien Viet khong co phan le. API cua SePay tra so tien dang chuoi co hai so le
 * nhu "18067000.00", con webhook gui so nguyen. Co phan le khac khong thi coi
 * la du lieu sai, tra ve rong de ben goi tu choi chu khong lam tron.
 */
export function wholeDong(value: unknown): bigint | null {
  const text = typeof value === 'number' ? String(value) : String(value ?? '').trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) {
    return null;
  }
  if (match[2] && /[1-9]/.test(match[2])) {
    return null;
  }
  return BigInt(match[1]);
}
