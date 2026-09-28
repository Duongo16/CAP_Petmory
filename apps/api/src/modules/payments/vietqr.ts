/**
 * Builds the transfer QR string in the EMVCo format Vietnamese banks use.
 *
 * The string is a series of three-part fields: a two-character tag, a two-character
 * length, then the value. The last field is a checksum computed over everything
 * before it, including its own tag and length.
 */

/** Formats one field as tag, length, value. */
function field(code: string, value: string): string {
  return code + value.length.toString().padStart(2, '0') + value;
}

/**
 * CRC-16 checksum, CCITT-FALSE variant: polynomial 0x1021, seed 0xFFFF.
 * This is the variant the payment standard requires.
 */
function codeCheck(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i += 1) {
    crc ^= str.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Strips Vietnamese accents and invalid characters from the transfer message.
 * Banks accept unaccented letters, digits and a few punctuation marks only.
 */
export function normalizeContent(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .slice(0, 50);
}

export interface QrInfo {
  /** Receiving bank identifier, six digits. */
  bankCode: string;
  accountNumber: string;
  /** Amount as an integer string in dong. */
  amount: string;
  content: string;
}

export function buildQrString(message: QrInfo): string {
  const beneficiary =
    field('00', message.bankCode) + field('01', message.accountNumber);

  const infoLabel =
    field('00', 'A000000727') + field('01', beneficiary) + field('02', 'QRIBFTTA');

  const partAdd = field('08', normalizeContent(message.content));

  const than =
    field('00', '01') +
    field('01', '12') +
    field('38', infoLabel) +
    field('53', '704') +
    field('54', message.amount) +
    field('58', 'VN') +
    field('62', partAdd);

  const beforeCodeCheck = `${than}6304`;
  return beforeCodeCheck + codeCheck(beforeCodeCheck);
}
