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

/** So tien: chi chu so, toi da hai chu so thap phan, dung nhu quy tac may chu. */
const COLOR_MONEY = /^\d{1,12}(\.\d{1,2})?$/;

/** Dau xuong dong, dung de tach phieu kiem tra thanh tung muc. */
const LINE_BREAK = String.fromCharCode(10);

/** Tach mot o nhieu dong thanh danh sach muc, bo cac dong trong. */
function asLines(typed: string): string[] {
  return typed
    .split(LINE_BREAK)
    .map((one) => one.trim())
    .filter((one) => one.length > 0);
}

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
   * typing. The server still validates everything, and the UI is never trusted.
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
    suggestDay: [10, [Validators.required, Validators.min(0), Validators.max(10000)]],
    suggestMonth: [150, [Validators.required, Validators.min(0), Validators.max(100000)]],
    suggestYear: [1500, [Validators.required, Validators.min(0), Validators.max(1000000)]],
    storyDay: [10, [Validators.required, Validators.min(0), Validators.max(10000)]],
    storyMonth: [150, [Validators.required, Validators.min(0), Validators.max(100000)]],
    storyYear: [1500, [Validators.required, Validators.min(0), Validators.max(1000000)]],
    chatDay: [60, [Validators.required, Validators.min(0), Validators.max(10000)]],
    chatMonth: [900, [Validators.required, Validators.min(0), Validators.max(100000)]],
    chatYear: [9000, [Validators.required, Validators.min(0), Validators.max(1000000)]],
    priceRestorePhoto: ['0', [Validators.required, Validators.pattern(COLOR_MONEY)]],
    priceDesignSuggestion: ['0', [Validators.required, Validators.pattern(COLOR_MONEY)]],
    priceStoryWriting: ['0', [Validators.required, Validators.pattern(COLOR_MONEY)]],
    priceChatReply: ['0', [Validators.required, Validators.pattern(COLOR_MONEY)]],
    qcChecklist: ['', [Validators.required, Validators.maxLength(4000)]],
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
    const checklist = asLines(v.qcChecklist);
    if (checklist.length === 0) {
      this.error.set('ADMIN.CONFIG.CHECKLIST_EMPTY');
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
          designSuggestion: { day: v.suggestDay, month: v.suggestMonth, year: v.suggestYear },
          storyWriting: { day: v.storyDay, month: v.storyMonth, year: v.storyYear },
          chatReply: { day: v.chatDay, month: v.chatMonth, year: v.chatYear },
        },
        aiUnitPrice: {
          restorePhoto: v.priceRestorePhoto,
          designSuggestion: v.priceDesignSuggestion,
          storyWriting: v.priceStoryWriting,
          chatReply: v.priceChatReply,
        },
        qcChecklist: checklist,
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
    const suggest = cf.aiQuota?.designSuggestion;
    const story = cf.aiQuota?.storyWriting;
    const chat = cf.aiQuota?.chatReply;
    const price = cf.aiUnitPrice;
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
      suggestDay: suggest?.day ?? 0,
      suggestMonth: suggest?.month ?? 0,
      suggestYear: suggest?.year ?? 0,
      storyDay: story?.day ?? 0,
      storyMonth: story?.month ?? 0,
      storyYear: story?.year ?? 0,
      chatDay: chat?.day ?? 0,
      chatMonth: chat?.month ?? 0,
      chatYear: chat?.year ?? 0,
      priceRestorePhoto: price?.restorePhoto?.$numberDecimal ?? '0',
      priceDesignSuggestion: price?.designSuggestion?.$numberDecimal ?? '0',
      priceStoryWriting: price?.storyWriting?.$numberDecimal ?? '0',
      priceChatReply: price?.chatReply?.$numberDecimal ?? '0',
      qcChecklist: (cf.qcChecklist ?? []).join(LINE_BREAK),
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
