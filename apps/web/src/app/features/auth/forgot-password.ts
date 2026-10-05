import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { Icon } from '../../shared/icon/icon';
import { LanguageToggle } from '../../shared/language-toggle/language-toggle';
import { Brand } from '../../shared/brand/brand';
import { DiaryScene } from '../../shared/diary-scene/diary-scene';

/**
 * Quen mat khau: nhap email de nhan thu dat lai.
 *
 * Gui xong luon bao cung mot cau, du email co tai khoan hay khong, de trang
 * nay khong thanh cach do xem ai da dang ky.
 */
@Component({
  selector: 'pm-forgot-password',
  standalone: true,
  imports: [LanguageToggle, Brand, DiaryScene, ReactiveFormsModule, RouterLink, TranslatePipe, Icon],
  templateUrl: './forgot-password.html',
  styleUrls: ['./auth-shared.scss', './login.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pendingSend = signal(false);
  readonly sent = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  send(): void {
    if (this.form.invalid || this.pendingSend()) {
      this.form.markAllAsTouched();
      return;
    }
    this.pendingSend.set(true);
    this.error.set(null);
    this.auth
      .forgotPassword(this.form.getRawValue().email.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pendingSend.set(false);
          this.sent.set(true);
        },
        error: () => {
          this.pendingSend.set(false);
          this.error.set('COMMON.GENERIC_ERROR');
        },
      });
  }
}
