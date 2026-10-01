import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PetsService } from '../../core/services/pets.service';
import { Icon } from '../../shared/icon/icon';

/** A benefit shown in the left panel. Both keys are written out in full. */
interface Perk {
  icon: string;
  nameKey: string;
  textKey: string;
}

/** The label for each strength step, written out so every key stays searchable. */
const STRENGTH_LABEL: Record<number, string> = {
  0: 'AUTH.STRENGTH_NONE',
  1: 'AUTH.STRENGTH_WEAK',
  2: 'AUTH.STRENGTH_FAIR',
  3: 'AUTH.STRENGTH_GOOD',
  4: 'AUTH.STRENGTH_STRONG',
};

const STRENGTH_STEPS = [1, 2, 3, 4];

/** Checks that the two password boxes hold the same thing. */
function samePassword(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value as string;
  const confirm = group.get('confirm')?.value as string;
  if (!confirm || password === confirm) {
    return null;
  }
  return { mismatch: true };
}

/** A rough score from zero to four, used only to colour the meter. */
function scorePassword(value: string): number {
  if (value.length === 0) {
    return 0;
  }
  let score = 0;
  if (value.length >= 8) {
    score += 1;
  }
  if (value.length >= 12) {
    score += 1;
  }
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) {
    score += 1;
  }
  if (/[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value)) {
    score += 1;
  }
  return Math.min(score, 4);
}

@Component({
  selector: 'pm-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, Icon],
  templateUrl: './register.html',
  styleUrls: ['./auth-shared.scss', './register.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly pets = inject(PetsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly pendingSend = signal(false);
  readonly error = signal<string | null>(null);
  readonly socialNotice = signal(false);
  readonly peeking = signal(false);
  readonly peekingConfirm = signal(false);

  /** Mirrors the password box, so the meter can react without reading the form. */
  readonly typed = signal('');

  readonly strength = computed(() => scorePassword(this.typed()));
  readonly strengthLabel = computed(() => STRENGTH_LABEL[this.strength()]);
  readonly steps = STRENGTH_STEPS;

  readonly perks: Perk[] = [
    { icon: 'bookmark', nameKey: 'AUTH.PERK.STORAGE.NAME', textKey: 'AUTH.PERK.STORAGE.OVERLAY' },
    { icon: 'comment', nameKey: 'AUTH.PERK.FOLLOW.NAME', textKey: 'AUTH.PERK.FOLLOW.OVERLAY' },
    { icon: 'star', nameKey: 'AUTH.PERK.VOUCHER.NAME', textKey: 'AUTH.PERK.VOUCHER.OVERLAY' },
  ];

  readonly form = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^0[0-9]{9}$/)]],
      petName: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required]],
      terms: [false, [Validators.requiredTrue]],
    },
    { validators: samePassword },
  );

  trackTyped(value: string): void {
    this.typed.set(value);
  }

  peek(): void {
    this.peeking.set(!this.peeking());
  }

  peekConfirm(): void {
    this.peekingConfirm.set(!this.peekingConfirm());
  }

  showSocialNotice(): void {
    this.socialNotice.set(true);
  }

  send(): void {
    if (this.form.invalid || this.pendingSend()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.pendingSend.set(true);
    this.error.set(null);

    const petName = value.petName.trim();

    this.auth
      .register(value.email, value.password, value.fullName, value.phone || undefined)
      .pipe(
        // The first pet is a nicety, so a failure there must not undo the account.
        switchMap(() =>
          petName.length > 0
            ? this.pets.create({ name: petName }).pipe(catchError(() => of(null)))
            : of(null),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.pendingSend.set(false);
          void this.router.navigate(['/home']);
        },
        error: () => {
          this.pendingSend.set(false);
          this.error.set('AUTH.BAD_CREDENTIALS');
        },
      });
  }
}
