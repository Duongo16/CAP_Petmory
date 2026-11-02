import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { DemoAccount } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';
import { LanguageToggle } from '../../shared/language-toggle/language-toggle';
import { ThemeToggle } from '../../shared/theme-toggle/theme-toggle';
import { AuthPhotos } from './auth-photos/auth-photos';
import { Brand } from '../../shared/brand/brand';
import { isVietnamesePhone } from '../../core/utils/vietnamese-phone';

const loginIdentifier = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  return value.includes('@') ? Validators.email(control) :
    (isVietnamesePhone(value) && value.length > 0 ? null : { identifier: true });
};

@Component({
  selector: 'pm-login',
  standalone: true,
  imports: [LanguageToggle, ThemeToggle, Brand, AuthPhotos, ReactiveFormsModule, RouterLink, TranslatePipe, Icon],
  templateUrl: './login.html',
  styleUrls: ['./auth-shared.scss', './login.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly continueUrl = this.route.snapshot.queryParamMap.get('continue');
  private readonly destroyRef = inject(DestroyRef);

  /** Tai khoan mau de bam mot phat la vao, chi co khi chay o may ca nhan. */
  readonly quickAccounts = signal<DemoAccount[]>([]);

  readonly pendingSend = signal(false);
  readonly error = signal<string | null>(null);


  /** Whether the password is shown as plain text. */
  readonly peeking = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, loginIdentifier]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    remember: [true],
  });

  ngOnInit(): void {
    this.auth
      .demoAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => this.quickAccounts.set(rows),
        error: () => this.quickAccounts.set([]),
      });
  }

  /** Dien san mot tai khoan mau roi vao thang, khong phai go gi. */
  quickIn(one: DemoAccount): void {
    this.form.patchValue({ email: one.email, password: one.password });
    this.send();
  }

  peek(): void {
    this.peeking.set(!this.peeking());
  }


  send(): void {
    if (this.form.invalid || this.pendingSend()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.pendingSend.set(true);
    this.error.set(null);

    this.auth
      .login(value.email, value.password, value.remember)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pendingSend.set(false);
          const continueUrl = this.route.snapshot.queryParamMap.get('continue');
          if (continueUrl?.startsWith('/') && !continueUrl.startsWith('//')) {
            if (this.auth.isInternal() && continueUrl.startsWith('/admin')) {
              void this.router.navigateByUrl(continueUrl);
              return;
            }
            if (!this.auth.isInternal() && !continueUrl.startsWith('/admin')) {
              void this.router.navigateByUrl(continueUrl);
              return;
            }
          }
          void this.router.navigate([this.auth.getDefaultRoute()]);
        },
        error: () => {
          this.pendingSend.set(false);
          this.error.set('AUTH.BAD_CREDENTIALS');
        },
      });
  }
}
