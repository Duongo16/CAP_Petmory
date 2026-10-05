import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { CommunityService } from '../../core/services/community.service';
import { samePassword } from '../auth/password-match';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

const PHONE = /^(0\d{9})?$/;
const IMAGE_TYPES = ['image/png', 'image/jpeg'];

/**
 * Tai khoan cua toi (muc 2): sua ho ten, so dien thoai, anh dai dien va doi mat
 * khau, khong phai vao khu cong dong. Dung cho ca khach va nhan vien.
 */
@Component({
  selector: 'pm-account-page',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './account-page.html',
  styleUrl: './account-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly community = inject(CommunityService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = this.auth.user;
  readonly initial = computed(() => (this.user()?.fullName ?? '?').trim().charAt(0).toUpperCase() || '?');
  readonly status = signal<ScreenState>('LOADING');
  readonly avatar = signal<string | null>(null);
  readonly profileBusy = signal(false);
  readonly profileNote = signal<{ key: string; bad: boolean } | null>(null);
  readonly passwordBusy = signal(false);
  readonly passwordNote = signal<{ key: string; bad: boolean } | null>(null);

  readonly profile = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.pattern(PHONE)] }),
  });

  readonly password = new FormGroup(
    {
      current: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8), Validators.maxLength(72)] }),
      confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: samePassword },
  );

  ngOnInit(): void {
    const me = this.user();
    if (!me) {
      this.status.set('ERROR');
      return;
    }
    this.community
      .profile(me.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (got) => {
          this.profile.reset({ fullName: got.fullName, phone: got.phone ?? '' });
          this.avatar.set(got.avatarUrl);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  /** Tai anh dai dien len truoc; ho so chi doi khi bam luu. */
  pickAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const me = this.user();
    if (!file || !me) {
      return;
    }
    if (!IMAGE_TYPES.includes(file.type)) {
      this.profileNote.set({ key: 'PET.PHOTO_WRONG_TYPE', bad: true });
      return;
    }
    this.profileBusy.set(true);
    this.community
      .uploadAvatar(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (got) => {
          this.profileBusy.set(false);
          this.avatar.set(this.community.avatarUrl(me.id, got.fileName));
          this.profile.markAsDirty();
        },
        error: () => {
          this.profileBusy.set(false);
          this.profileNote.set({ key: 'COMMON.GENERIC_ERROR', bad: true });
        },
      });
  }

  saveProfile(): void {
    this.profile.markAllAsTouched();
    if (this.profile.invalid) {
      this.profileNote.set({ key: 'ACCOUNT.PROFILE_INVALID', bad: true });
      return;
    }
    const value = this.profile.getRawValue();
    const body = { fullName: value.fullName.trim(), phone: value.phone.trim(), avatarUrl: this.avatar() ?? '' };
    this.profileBusy.set(true);
    this.profileNote.set(null);
    this.community
      .updateProfile(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.profileBusy.set(false);
          this.auth.patchUser({ fullName: body.fullName, avatarUrl: this.avatar() });
          this.profile.markAsPristine();
          this.profileNote.set({ key: 'ACCOUNT.PROFILE_SAVED', bad: false });
        },
        error: () => {
          this.profileBusy.set(false);
          this.profileNote.set({ key: 'COMMON.GENERIC_ERROR', bad: true });
        },
      });
  }

  changePassword(): void {
    this.password.markAllAsTouched();
    if (this.password.invalid) {
      this.passwordNote.set({ key: this.password.hasError('mismatch') ? 'ACCOUNT.PASSWORD_MISMATCH' : 'ACCOUNT.PASSWORD_INVALID', bad: true });
      return;
    }
    const value = this.password.getRawValue();
    this.passwordBusy.set(true);
    this.passwordNote.set(null);
    this.auth
      .changePassword(value.current, value.password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.passwordBusy.set(false);
          this.password.reset();
          this.passwordNote.set({ key: 'ACCOUNT.PASSWORD_CHANGED', bad: false });
        },
        error: (trouble: HttpErrorResponse) => {
          this.passwordBusy.set(false);
          this.passwordNote.set({ key: trouble.status === 400 ? 'ACCOUNT.PASSWORD_WRONG' : 'COMMON.GENERIC_ERROR', bad: true });
        },
      });
  }
}
