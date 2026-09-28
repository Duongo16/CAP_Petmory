import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';

interface LoginForm {
  email: string;
  password: string;
  fullName: string;
}

@Component({
  selector: 'pm-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    TranslatePipe,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly modeRegister = signal(false);
  readonly pendingSend = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    fullName: [''],
  });

  changeMode(): void {
    const register = !this.modeRegister();
    this.modeRegister.set(register);
    this.error.set(null);
    const fullName = this.form.controls.fullName;
    fullName.setValidators(register ? [Validators.required, Validators.minLength(2)] : []);
    fullName.updateValueAndValidity();
  }

  send(): void {
    if (this.form.invalid || this.pendingSend()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue() as LoginForm;
    this.pendingSend.set(true);
    this.error.set(null);

    const stream = this.modeRegister()
      ? this.auth.register(value.email, value.password, value.fullName)
      : this.auth.login(value.email, value.password);

    stream.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
