import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { PetDraftService } from '../../core/services/pet-draft.service';
import { DemoAccount } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';
import { PetArt, PetArtKind } from '../../shared/pet-art/pet-art';
import { DiaryScene } from '../../shared/diary-scene/diary-scene';
import { Brand } from '../../shared/brand/brand';

@Component({
  selector: 'pm-login',
  standalone: true,
  imports: [Brand, DiaryScene, ReactiveFormsModule, RouterLink, TranslatePipe, Icon, PetArt],
  templateUrl: './login.html',
  styleUrls: ['./auth-shared.scss', './login.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly drafts = inject(PetDraftService);

  /** The pet profile started on the welcome page, waiting for this account. */
  readonly draft = this.drafts.draft;
  readonly draftArt = computed<PetArtKind>(() => (this.draft()?.kind === 'CAT' ? 'cat' : 'dog'));
  private readonly destroyRef = inject(DestroyRef);

  /** Tai khoan mau de bam mot phat la vao, chi co khi chay o may ca nhan. */
  readonly quickAccounts = signal<DemoAccount[]>([]);

  readonly pendingSend = signal(false);
  readonly error = signal<string | null>(null);

  /** Turns true when a social button is pressed, which is not wired up yet. */
  readonly socialNotice = signal(false);

  /** Whether the password is shown as plain text. */
  readonly peeking = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
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

    this.auth
      .login(value.email, value.password)
      .pipe(
        // A pet started on the welcome page joins the account it signs in to.
        switchMap(() => this.drafts.claim()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.pendingSend.set(false);
          const continueUrl = this.route.snapshot.queryParamMap.get('continue');
          if (continueUrl) {
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
