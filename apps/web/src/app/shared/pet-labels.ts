import { Gender, PetKind } from '../core/models/api.model';

/**
 * The wording used for a pet's kind and sex, shared by the screens a customer
 * sees and the internal ones. Every key is written out in full so it can be
 * found in the source; keys are never built by joining strings.
 */
export const LABEL_KIND: Record<PetKind, string> = {
  DOG: 'PET.KIND.DOG',
  CAT: 'PET.KIND.CAT',
  RABBIT: 'PET.KIND.RABBIT',
  HAMSTER: 'PET.KIND.HAMSTER',
  BIRD: 'PET.KIND.BIRD',
  OTHER: 'PET.KIND.OTHER',
};

export const LABEL_GENDER: Record<Gender, string> = {
  MALE: 'PET.GENDER.MALE',
  FEMALE: 'PET.GENDER.FEMALE',
  UNKNOWN: 'PET.GENDER.UNKNOWN',
};

export function kindKeyOf(kind: PetKind): string {
  return LABEL_KIND[kind] ?? LABEL_KIND.OTHER;
}

export function genderKeyOf(gender: Gender): string {
  return LABEL_GENDER[gender] ?? LABEL_GENDER.UNKNOWN;
}
