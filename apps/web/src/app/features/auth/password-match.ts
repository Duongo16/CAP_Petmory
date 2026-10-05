import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Hai o mat khau phai giong nhau. Dung cho nhom co o "password" va o "confirm". */
export function samePassword(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value as string;
  const confirm = group.get('confirm')?.value as string;
  if (!confirm || password === confirm) {
    return null;
  }
  return { mismatch: true };
}
