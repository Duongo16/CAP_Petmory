import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { Carer, Gender, Pet, PetKind, PetStatus } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';
import { ImageLink } from '../../shared/image-link/image-link';
import { PhotoPreviews } from '../../shared/photo-previews/photo-previews';
import { looksLikeImage } from '../../core/utils/upload-image';

/** What the dialog is opened with. A missing pet means it is adding a new one. */
export interface PetFormInput {
  pet: Pet | null;
}

/** What the dialog hands back: the values to save, plus any pictures chosen. */
export interface PetFormResult {
  values: {
    name: string;
    kind: PetKind;
    breed: string;
    gender: Gender;
    birthDate: string;
    status: PetStatus;
    passedAwayDate: string;
    tagline: string;
    adoptionDate: string;
    microchip: string;
    neutered: boolean;
    trait: string[];
    carer: Carer[];
  };
  photos: File[];
  /** Anh dan tu duong dan tren mang, may chu se tu tai ve. */
  photoLinks: string[];
}

/** One choice in a dropdown, with its label key written out in full. */
interface Choice<T> {
  value: T;
  key: string;
}

const KIND_CHOICES: Choice<PetKind>[] = [
  { value: 'DOG', key: 'PET.KIND.DOG' },
  { value: 'CAT', key: 'PET.KIND.CAT' },
  { value: 'RABBIT', key: 'PET.KIND.RABBIT' },
  { value: 'HAMSTER', key: 'PET.KIND.HAMSTER' },
  { value: 'BIRD', key: 'PET.KIND.BIRD' },
  { value: 'OTHER', key: 'PET.KIND.OTHER' },
];

const GENDER_CHOICES: Choice<Gender>[] = [
  { value: 'MALE', key: 'PET.GENDER.MALE' },
  { value: 'FEMALE', key: 'PET.GENDER.FEMALE' },
  { value: 'UNKNOWN', key: 'PET.GENDER.UNKNOWN' },
];

const STATUS_CHOICES: Choice<PetStatus>[] = [
  { value: 'TOGETHER', key: 'PET.TOGETHER' },
  { value: 'PASSED_AWAY', key: 'PET.PASSED_AWAY' },
];

/** One person per line, so the box for carers reads as a short list. */
const LINE_BREAK = String.fromCharCode(10);

const PHOTO_MAX = 8;

/**
 * Checks the dates against each other and against the status.
 *
 * The same rules are enforced on the server, which is what actually protects the
 * data. Repeating them here only saves the reader a round trip before being told.
 */
function checkDates(group: AbstractControl): ValidationErrors | null {
  const status = group.get('status')?.value as PetStatus;
  const birth = group.get('birthDate')?.value as string;
  const gone = group.get('passedAwayDate')?.value as string;
  const today = new Date().toISOString().slice(0, 10);

  if (birth && birth > today) {
    return { birthAhead: true };
  }
  if (status !== 'PASSED_AWAY') {
    return null;
  }
  if (!gone) {
    return { goneMissing: true };
  }
  if (gone > today) {
    return { goneAhead: true };
  }
  if (birth && gone < birth) {
    return { goneBeforeBirth: true };
  }
  return null;
}

/**
 * Checks the day the pet came home. It cannot be a day still to come, and it
 * cannot be before the pet was born. The server checks the same thing.
 */
function checkCameHome(group: AbstractControl): ValidationErrors | null {
  const came = group.get('adoptionDate')?.value as string;
  if (!came) {
    return null;
  }
  if (came > new Date().toISOString().slice(0, 10)) {
    return { cameAhead: true };
  }
  const birth = group.get('birthDate')?.value as string;
  return birth && came < birth ? { cameBeforeBirth: true } : null;
}

/** Splits what was typed into separate notes, dropping the blanks. */
function asList(typed: string): string[] {
  return typed
    .split(',')
    .map((one) => one.trim())
    .filter((one) => one.length > 0);
}

/**
 * Reads the people at home out of one line per person, written as a name and
 * then what they do, separated by a dash.
 */
function asCarers(typed: string): Carer[] {
  const out: Carer[] = [];
  for (const line of typed.split(LINE_BREAK)) {
    const [name, ...rest] = line.split('-');
    if (name.trim()) {
      out.push({ name: name.trim(), role: rest.join('-').trim() });
    }
  }
  return out;
}

@Component({
  selector: 'pm-pet-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Icon, ImageLink, PhotoPreviews],
  templateUrl: './pet-form-dialog.html',
  styleUrl: './pet-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly ref = inject<MatDialogRef<PetFormDialog, PetFormResult>>(MatDialogRef);
  private readonly data = inject<PetFormInput>(MAT_DIALOG_DATA);

  readonly editing = this.data.pet !== null;
  readonly kinds = KIND_CHOICES;
  readonly genders = GENDER_CHOICES;
  readonly statuses = STATUS_CHOICES;

  /** Pictures chosen in this sitting, sent after the profile itself is saved. */
  readonly photos = signal<File[]>([]);
  readonly photoLinks = signal<string[]>([]);

  /** Tong so anh dang dinh kem, tinh ca tep lan duong dan. */
  readonly photoCount = computed(() => this.photos().length + this.photoLinks().length);
  readonly photoFull = computed(() => this.photoCount() >= PHOTO_MAX);
  readonly photoMax = PHOTO_MAX;
  readonly photoError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      name: [this.data.pet?.name ?? '', [Validators.required, Validators.maxLength(100)]],
      kind: [(this.data.pet?.kind ?? 'DOG') as PetKind],
      breed: [this.data.pet?.breed ?? '', [Validators.maxLength(100)]],
      gender: [(this.data.pet?.gender ?? 'UNKNOWN') as Gender],
      birthDate: [dayOf(this.data.pet?.birthDate)],
      status: [(this.data.pet?.status ?? 'TOGETHER') as PetStatus],
      passedAwayDate: [dayOf(this.data.pet?.passedAwayDate)],
      tagline: [this.data.pet?.tagline ?? '', [Validators.maxLength(200)]],
      adoptionDate: [dayOf(this.data.pet?.adoptionDate)],
      microchip: [this.data.pet?.microchip ?? '', [Validators.maxLength(40)]],
      neutered: [this.data.pet?.neutered ?? false],
      trait: [(this.data.pet?.trait ?? []).join(', '), [Validators.maxLength(400)]],
      carer: [
        (this.data.pet?.carer ?? [])
          .map((one) => (one.role ? `${one.name} - ${one.role}` : one.name))
          .join(LINE_BREAK),
        [Validators.maxLength(600)],
      ],
    },
    { validators: [checkDates, checkCameHome] },
  );

  /** Mirrors the status box so the memorial date can appear only when it applies. */
  readonly status = signal<PetStatus>((this.data.pet?.status ?? 'TOGETHER') as PetStatus);

  readonly memorial = computed(() => this.status() === 'PASSED_AWAY');

  /** Today, so neither date box offers a day that has not happened. */
  readonly today = new Date().toISOString().slice(0, 10);

  setStatus(value: PetStatus): void {
    this.status.set(value);
    this.form.controls.status.setValue(value);
    // Quay lai trang thai dang o cung thi ngay roi xa khong con y nghia nua.
    if (value !== 'PASSED_AWAY') {
      this.form.controls.passedAwayDate.setValue('');
    }
    this.form.updateValueAndValidity();
  }

  pickPhotos(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    this.photoError.set(null);

    const wrong = chosen.filter((f) => !looksLikeImage(f));
    if (wrong.length > 0) {
      this.photoError.set('PET.PHOTO_WRONG_TYPE');
      return;
    }
    const total = [...this.photos(), ...chosen];
    if (total.length + this.photoLinks().length > PHOTO_MAX) {
      this.photoError.set('PET.PHOTO_TOO_MANY');
      return;
    }
    this.photos.set(total);
  }

  addLink(link: string): void {
    this.photoError.set(null);
    if (this.photos().length + this.photoLinks().length >= PHOTO_MAX) {
      this.photoError.set('PET.PHOTO_TOO_MANY');
      return;
    }
    if (!this.photoLinks().includes(link)) {
      this.photoLinks.update((list) => [...list, link]);
    }
  }

  dropLink(index: number): void {
    this.photoLinks.update((list) => list.filter((_, i) => i !== index));
    this.photoError.set(null);
  }

  dropPhoto(index: number): void {
    this.photos.update((list) => list.filter((_, i) => i !== index));
    this.photoError.set(null);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.ref.close({
      values: {
        ...raw,
        trait: asList(raw.trait),
        carer: asCarers(raw.carer),
      },
      photos: this.photos(),
      photoLinks: this.photoLinks(),
    });
  }

  close(): void {
    this.ref.close(undefined);
  }
}

/** The date part of a stored timestamp, in the shape a date box expects. */
function dayOf(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}
