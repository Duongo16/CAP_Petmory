import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { A11yModule } from '@angular/cdk/a11y';
import { TranslatePipe } from '@ngx-translate/core';
import { Gender, PetKind } from '../../../core/models/api.model';
import { PetDraft, PetDraftService } from '../../../core/services/pet-draft.service';
import { LABEL_GENDER, LABEL_KIND } from '../../../shared/pet-labels';
import { Icon } from '../../../shared/icon/icon';
import { PetArt, PetArtKind } from '../../../shared/pet-art/pet-art';
import { looksLikeImage, PICK_MAX_BYTES } from '../../../core/utils/upload-image';

type Step = 1 | 2 | 3 | 4;
type PhotoProblem = 'TYPE' | 'SIZE' | null;

interface StarterForm {
  name: FormControl<string>;
  kind: FormControl<PetKind>;
  breed: FormControl<string>;
  gender: FormControl<Gender>;
  birthDate: FormControl<string>;
  tagline: FormControl<string>;
}

const KIND_ORDER: PetKind[] = ['DOG', 'CAT', 'RABBIT', 'HAMSTER', 'BIRD', 'OTHER'];
const GENDER_ORDER: Gender[] = ['MALE', 'FEMALE', 'UNKNOWN'];
const STEP_COUNT = 4;

/**
 * The guided start for a visitor without an account: a few questions about
 * their pet, a preview, then the way to sign up. What they type is kept as a
 * draft and becomes a real pet as soon as they are signed in.
 */
@Component({
  selector: 'pm-pet-starter',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, A11yModule, TranslatePipe, Icon, PetArt],
  templateUrl: './pet-starter.html',
  styleUrl: './pet-starter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetStarter implements OnInit {
  private readonly drafts = inject(PetDraftService);

  /** The chosen picture, shown through a short-lived object address. */
  readonly photo = this.drafts.photo;
  readonly photoUrl = signal<string | null>(null);
  readonly photoProblem = signal<PhotoProblem>(null);

  /** Keeps the preview address in step with the picture and frees the old one. */
  protected readonly photoPreview = effect((onCleanup) => {
    const file = this.photo();
    const url = file ? URL.createObjectURL(file) : null;
    this.photoUrl.set(url);
    onCleanup(() => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    });
  });

  readonly closed = output<void>();

  readonly step = signal<Step>(1);
  readonly stepCount = STEP_COUNT;
  readonly today = new Date().toISOString().slice(0, 10);

  readonly kinds = KIND_ORDER.map((value) => ({
    value,
    key: LABEL_KIND[value],
    art: (value === 'DOG' ? 'dog' : value === 'CAT' ? 'cat' : null) as PetArtKind | null,
  }));
  readonly genders = GENDER_ORDER.map((value) => ({ value, key: LABEL_GENDER[value] }));

  readonly form = new FormGroup<StarterForm>({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    kind: new FormControl<PetKind>('DOG', { nonNullable: true }),
    breed: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    gender: new FormControl<Gender>('UNKNOWN', { nonNullable: true }),
    birthDate: new FormControl('', { nonNullable: true }),
    tagline: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly pickedKind = computed(() => this.value().kind);
  readonly pickedGender = computed(() => this.value().gender);
  readonly progressScale = computed(() => `scaleX(${this.step() / STEP_COUNT})`);

  /** What the preview card shows, read from the form so it follows every edit. */
  readonly preview = computed(() => {
    const raw = this.value();
    const kind = raw.kind ?? 'OTHER';
    return {
      name: (raw.name ?? '').trim(),
      kindKey: LABEL_KIND[kind],
      genderKey: LABEL_GENDER[raw.gender ?? 'UNKNOWN'],
      breed: (raw.breed ?? '').trim(),
      birthDate: raw.birthDate || null,
      tagline: (raw.tagline ?? '').trim(),
      art: (kind === 'CAT' ? 'cat' : 'dog') as PetArtKind,
    };
  });

  readonly birthInFuture = computed(() => {
    const birth = this.value().birthDate;
    return !!birth && birth > this.today;
  });

  ngOnInit(): void {
    const kept = this.drafts.draft();
    if (kept) {
      this.form.setValue(kept);
    }
  }

  choosePhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) {
      return;
    }
    if (!looksLikeImage(file)) {
      this.photoProblem.set('TYPE');
      return;
    }
    if (file.size > PICK_MAX_BYTES) {
      this.photoProblem.set('SIZE');
      return;
    }
    this.photoProblem.set(null);
    this.drafts.setPhoto(file);
  }

  removePhoto(): void {
    this.photoProblem.set(null);
    this.drafts.setPhoto(null);
  }

  pickKind(kind: PetKind): void {
    this.form.controls.kind.setValue(kind);
  }

  pickGender(gender: Gender): void {
    this.form.controls.gender.setValue(gender);
  }

  next(): void {
    if (this.step() === 1) {
      const name = this.form.controls.name;
      name.setValue(name.value.trim());
      if (name.invalid) {
        name.markAsTouched();
        return;
      }
      this.step.set(2);
      return;
    }
    if (this.step() === 2) {
      const { breed, tagline } = this.form.controls;
      if (breed.invalid || tagline.invalid || this.birthInFuture()) {
        this.form.markAllAsTouched();
        return;
      }
      this.drafts.save(this.form.getRawValue() satisfies PetDraft);
      this.step.set(3);
      return;
    }
    if (this.step() === 3) {
      this.step.set(4);
    }
  }

  back(): void {
    const at = this.step();
    if (at > 1) {
      this.step.set((at - 1) as Step);
    }
  }

  close(): void {
    this.closed.emit();
  }
}
