import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { BusinessConfig } from '../../core/models/api.model';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

/** Uppercase unaccented letters, digits and spaces only, matching the server rule. */
const COLOR_ACCOUNT_HOLDER = /^[A-Z0-9 ]{2,100}$/;

@Component({
  selector: 'pm-admin-config-page',
  standalone: true,
  imports: [ReactiveFormsModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './admin-config-page.html',
  styleUrl: './admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminConfigPage implements OnInit {
  private readonly service = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly isManager = inject(AuthService).isManager;
  readonly status = signal<ScreenState>('LOADING');
  readonly error = signal<string | null>(null);
  readonly saved = signal(false);
  readonly saving = signal(false);
  readonly lastEditedBy = signal<string | null>(null);

  /**
   * These rules deliberately mirror the server's, so the user sees a mistake while
   * typing. The server still validates everything; the UI is never trusted.
   */
  readonly form = this.fb.nonNullable.group({
    defaultPetProfileLimit: [5, [Validators.required, Validators.min(1), Validators.max(100)]],
    qrExpiryHours: [24, [Validators.required, Validators.min(1), Validators.max(720)]],
    estimatedShippingDays: [3, [Validators.required, Validators.min(1), Validators.max(60)]],
    goodShortEdgePx: [
      1024,
      [Validators.required, Validators.min(200), Validators.max(8000)],
    ],
    warnShortEdgePx: [600, [Validators.required, Validators.min(100), Validators.max(8000)]],
    maxPhotoSizeMb: [10, [Validators.required, Validators.min(1), Validators.max(50)]],
    quotaDay: [20, [Validators.required, Validators.min(0), Validators.max(10000)]],
    quotaMonth: [300, [Validators.required, Validators.min(0), Validators.max(100000)]],
    quotaYear: [3000, [Validators.required, Validators.min(0), Validators.max(1000000)]],
    bankCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    bankName: ['', [Validators.required, Validators.maxLength(100)]],
    accountNumber: ['', [Validators.required, Validators.pattern(/^\d{6,20}$/)]],
    accountHolder: ['', [Validators.required, Validators.pattern(COLOR_ACCOUNT_HOLDER)]],
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.status.set('LOADING');
    this.service
      .getConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cf) => {
          this.fillForm(cf);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  save(): void {
    this.saved.set(false);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    if (v.warnShortEdgePx >= v.goodShortEdgePx) {
      this.error.set('ADMIN.CONFIG.THRESHOLD_ERROR');
      return;
    }

    this.saving.set(true);
    this.service
      .updateConfig({
        defaultPetProfileLimit: v.defaultPetProfileLimit,
        qrExpiryHours: v.qrExpiryHours,
        estimatedShippingDays: v.estimatedShippingDays,
        goodShortEdgePx: v.goodShortEdgePx,
        warnShortEdgePx: v.warnShortEdgePx,
        maxPhotoSizeMb: v.maxPhotoSizeMb,
        aiQuota: {
          restorePhoto: { day: v.quotaDay, month: v.quotaMonth, year: v.quotaYear },
        },
        bankCode: v.bankCode,
        bankName: v.bankName,
        accountNumber: v.accountNumber,
        accountHolder: v.accountHolder,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cf) => {
          this.saving.set(false);
          this.saved.set(true);
          this.fillForm(cf);
        },
        error: (e: { status?: number }) => {
          this.saving.set(false);
          this.error.set(e.status === 403 ? 'ADMIN.ERROR_NOT_RAW_PERMISSION' : 'COMMON.GENERIC_ERROR');
        },
      });
  }

  private fillForm(cf: BusinessConfig): void {
    const quota = cf.aiQuota?.restorePhoto;
    this.form.patchValue({
      defaultPetProfileLimit: cf.defaultPetProfileLimit,
      qrExpiryHours: cf.qrExpiryHours,
      estimatedShippingDays: cf.estimatedShippingDays,
      goodShortEdgePx: cf.goodShortEdgePx,
      warnShortEdgePx: cf.warnShortEdgePx,
      maxPhotoSizeMb: cf.maxPhotoSizeMb,
      quotaDay: quota?.day ?? 0,
      quotaMonth: quota?.month ?? 0,
      quotaYear: quota?.year ?? 0,
      bankCode: cf.bankCode,
      bankName: cf.bankName,
      accountNumber: cf.accountNumber,
      accountHolder: cf.accountHolder,
    });
    this.lastEditedBy.set(cf.lastEditedBy);
    if (!this.isManager()) {
      this.form.disable();
    }
  }
}
