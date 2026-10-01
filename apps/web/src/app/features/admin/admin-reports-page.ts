import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ReportsService } from '../../core/services/reports.service';
import { AuthService } from '../../core/services/auth.service';
import { AiCostReport, ProgressReport, RevenueReport } from '../../core/models/api.model';
import { KEY_STATUS_ORDER } from '../../shared/order-status';
import { OrderStatus } from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

/** Ba bao cao, viet san de khong bao gio ghep chuoi thanh khoa. */
type WhichReport = 'revenue' | 'ai-cost' | 'progress';

/** Ten hien cua tung loai luot dung tri tue nhan tao. */
const AI_KIND_KEY: Record<string, string> = {
  restorePhoto: 'ADMIN.CONFIG.PRICE_RESTORE_PHOTO',
  designSuggestion: 'ADMIN.CONFIG.PRICE_DESIGN_SUGGESTION',
  storyWriting: 'ADMIN.CONFIG.PRICE_STORY_WRITING',
  chatReply: 'ADMIN.CONFIG.PRICE_CHAT_REPLY',
};

const AI_KIND_KEY_OTHER = 'ADMIN.REPORT.AI_OTHER';

/** Ten hien cua hai dong hang. */
const KIND_KEY: Record<string, string> = {
  MADE_TO_ORDER: 'ADMIN.REPORT.KIND_MADE',
  READY_MADE: 'ADMIN.REPORT.KIND_READY',
};

const KIND_KEY_OTHER = 'ADMIN.REPORT.KIND_OTHER';

/** Mac dinh nhin lai bao nhieu ngay. */
const DEFAULT_DAYS = 30;

const DAY_MS = 86_400_000;

/**
 * Ba bao cao quan tri: doanh thu, chi phi tri tue nhan tao, tien do san xuat.
 *
 * Man hinh chi doc. Khong o nao o day sua duoc du lieu, dung theo muc 22
 * khoan 11, va nhom Quan tri vien chi thay phan tien do.
 */
@Component({
  selector: 'pm-admin-reports-page',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, MoneyPipe],
  templateUrl: './admin-reports-page.html',
  styleUrl: './admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReportsPage implements OnInit {
  private readonly service = inject(ReportsService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  /** Chi nhom Quan ly duoc xem doanh thu va chi phi. */
  readonly seesMoney = inject(AuthService).isManager;

  readonly status = signal<ScreenState>('LOADING');
  readonly revenue = signal<RevenueReport | null>(null);
  readonly aiCost = signal<AiCostReport | null>(null);
  readonly progress = signal<ProgressReport | null>(null);
  readonly downloading = signal<WhichReport | null>(null);
  readonly fileLink = signal('');
  readonly fileName = signal('');

  readonly form = this.fb.nonNullable.group({
    from: [dayText(new Date(Date.now() - DEFAULT_DAYS * DAY_MS))],
    to: [dayText(new Date())],
  });

  private readonly cleanup = this.destroyRef.onDestroy(() => this.release());

  /** Doanh thu tach theo dong hang, kem ten doc duoc. */
  readonly kindRows = computed(() =>
    (this.revenue()?.byKind ?? []).map((one) => ({
      raw: one,
      key: KIND_KEY[one.name] ?? KIND_KEY_OTHER,
    })),
  );

  readonly aiRows = computed(() =>
    (this.aiCost()?.rows ?? []).map((one) => ({
      raw: one,
      key: AI_KIND_KEY[one.kind] ?? AI_KIND_KEY_OTHER,
    })),
  );

  readonly statusRows = computed(() =>
    (this.progress()?.byStatus ?? []).map((one) => ({
      raw: one,
      key: KEY_STATUS_ORDER[one.status as OrderStatus] ?? '',
    })),
  );

  ngOnInit(): void {
    this.read();
  }

  /**
   * Doc lai ca ba bao cao.
   *
   * Nhom Quan tri vien khong duoc xem doanh thu va chi phi, nen hai duong do
   * tra ve khong co gi thay vi lam hong ca man hinh.
   */
  read(): void {
    this.status.set('LOADING');
    const period = this.periodOf();
    const money = this.seesMoney();
    forkJoin({
      revenue: money
        ? this.service.revenue(period).pipe(catchError(() => of(null)))
        : of(null),
      aiCost: money
        ? this.service.aiCost(period).pipe(catchError(() => of(null)))
        : of(null),
      progress: this.service.progress(period),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (all) => {
          this.revenue.set(all.revenue);
          this.aiCost.set(all.aiCost);
          this.progress.set(all.progress);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  /**
   * Nhan mot bao cao ve dang tep CSV.
   *
   * Tep di qua duong co kiem quyen nen phai nhan ve trinh duyet truoc, roi
   * moi dung mot dia chi tam cho nut luu xuong.
   */
  fetchFile(which: WhichReport): void {
    this.downloading.set(which);
    this.service
      .fileOf(which, this.periodOf())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.release();
          this.fileLink.set(URL.createObjectURL(blob));
          this.fileName.set(`${which}.csv`);
          this.downloading.set(null);
        },
        error: () => this.downloading.set(null),
      });
  }

  private periodOf() {
    const raw = this.form.getRawValue();
    return {
      from: raw.from ? new Date(raw.from).toISOString() : undefined,
      to: raw.to ? new Date(`${raw.to}T23:59:59`).toISOString() : undefined,
    };
  }

  private release(): void {
    const old = this.fileLink();
    if (old) {
      URL.revokeObjectURL(old);
    }
  }
}

/** Mot ngay duoi dang o nhap ngay cua trinh duyet. */
function dayText(when: Date): string {
  const two = (value: number) => String(value).padStart(2, '0');
  return `${when.getFullYear()}-${two(when.getMonth() + 1)}-${two(when.getDate())}`;
}
