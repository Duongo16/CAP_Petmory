import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { Icon } from '../../shared/icon/icon';
import { LanguageToggle } from '../../shared/language-toggle/language-toggle';
import { Brand } from '../../shared/brand/brand';
import { DiaryScene } from '../../shared/diary-scene/diary-scene';
import { samePassword } from './password-match';

/** Trang thai cua trang: chua co ma, dang nhap mat khau, da doi xong, hay ma het han. */
type ResetState = 'NO_TOKEN' | 'FORM' | 'DONE' | 'EXPIRED';

/**
 * Dat mat khau moi tu duong dan trong thu.
 *
 * Doi xong thi moi phien dang mo deu bi dang xuat, ke ca phien cua nguoi co
 * the da chiem tai khoan, nen nguoi dung phai dang nhap lai.
 */
@Component({
  selector: 'pm-reset-password',
  standalone: true,
  imports: [LanguageToggle, Brand, DiaryScene, ReactiveFormsModule, RouterLink, TranslatePipe, Icon],
  templateUrl: './reset-password.html',
  styleUrls: ['./auth-shared.scss', './login.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';

  readonly state = signal<ResetState>(this.token ? 'FORM' : 'NO_TOKEN');
  readonly pendingSend = signal(false);
  readonly error = signal<string | null>(null);
  readonly peeking = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirm: ['', [Validators.required]],
    },
    { validators: samePassword },
  );

  peek(): void {
    this.peeking.update((on) => !on);
  }

  send(): void {
    if (this.form.invalid || this.pendingSend()) {
      this.form.markAllAsTouched();
      return;
    }
    this.pendingSend.set(true);
    this.error.set(null);
    this.auth
      .resetPassword(this.token, this.form.getRawValue().password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pendingSend.set(false);
          this.state.set('DONE');
        },
        error: (trouble: { status?: number }) => {
          this.pendingSend.set(false);
          if (trouble.status === 400) {
            this.state.set('EXPIRED');
            return;
          }
          this.error.set('COMMON.GENERIC_ERROR');
        },
      });
  }
}
