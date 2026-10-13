import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** The canonical local form used by the API and persisted on a profile. */
export const VIETNAMESE_PHONE = /^0\d{9}$/;

/**
 * Turns common, unambiguous ways Vietnamese numbers are written into the
 * canonical ten-digit local form. Other punctuation is deliberately retained
 * so it is rejected by the validator rather than silently changing the input.
 */
export function normalizeVietnamesePhone(value: string): string {
  const compact = value.trim().replace(/[\s-]/g, '');
  return compact.startsWith('+84') ? `0${compact.slice(3)}` : compact;
}

/** An empty number is allowed for optional profile fields. */
export function isVietnamesePhone(value: string): boolean {
  const normalized = normalizeVietnamesePhone(value);
  return normalized === '' || VIETNAMESE_PHONE.test(normalized);
}

export const optionalVietnamesePhone: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null =>
  isVietnamesePhone(String(control.value ?? '')) ? null : { vietnamesePhone: true };
