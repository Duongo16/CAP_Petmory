/** The single local representation saved for a Vietnamese mobile number. */
export const VIETNAMESE_PHONE = /^(0\d{9})?$/;

/**
 * Normalizes only familiar, unambiguous Vietnamese forms before validation.
 * Any other characters remain in the value and are rejected by the regex.
 */
export function normalizeVietnamesePhone(value: string): string {
  const compact = value.trim().replace(/[\s-]/g, '');
  return compact.startsWith('+84') ? `0${compact.slice(3)}` : compact;
}
