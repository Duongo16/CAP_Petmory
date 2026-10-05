import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminService } from '../../core/services/admin.service';
import { DiaryModerationCard } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';
type Tab = 'PUBLIC' | 'BLOCKED';

/** Ly do an toi thieu bay nhieu ky tu, giu bang phia may chu. */
const REASON_MIN = 5;

const TAB_KEY: Record<Tab, string> = {
  PUBLIC: 'ADMIN.MODERATION.TAB_PUBLIC',
  BLOCKED: 'ADMIN.MODERATION.TAB_BLOCKED',
};

/**
 * Kiem duyet cong dong (muc 20): an nhat ky cong khai vi pham, hoac cho hien lai.
 *
 * Ly do an la bat buoc va duoc may chu ghi vao nhat ky thao tac kem ten nguoi
 * lam. Quyen bi an van doc duoc voi chu nhan, chi bien mat voi nguoi ngoai.
 */
@Component({
  selector: 'pm-admin-moderation-page',
  standalone: true,
  imports: [DatePipe, RouterLink, MatProgressSpinnerModule, TranslatePipe, Icon],
  templateUrl: './admin-moderation-page.html',
  styleUrls: ['./admin-shared.scss', './admin-moderation-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminModerationPage implements OnInit {
  private readonly service = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly tab = signal<Tab>('PUBLIC');
  readonly keyword = signal('');
  readonly page = signal(1);
  readonly pageCount = signal(1);
  readonly total = signal(0);
  readonly rows = signal<DiaryModerationCard[]>([]);
  readonly hidingId = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly problem = signal<string | null>(null);
  readonly reasonMin = REASON_MIN;

  readonly tabs = computed(() =>
    (['PUBLIC', 'BLOCKED'] as Tab[]).map((code) => ({ code, key: TAB_KEY[code], on: this.tab() === code })),
  );

  ngOnInit(): void {
    this.load();
  }

  pickTab(code: Tab): void {
    this.tab.set(code);
    this.page.set(1);
    this.hidingId.set(null);
    this.load();
  }

  search(text: string): void {
    this.keyword.set(text);
    this.page.set(1);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  startHide(petId: string): void {
    this.problem.set(null);
    this.hidingId.set(petId);
  }

  cancelHide(): void {
    this.hidingId.set(null);
  }

  hide(petId: string, reason: string): void {
    const clean = reason.trim();
    if (clean.length < REASON_MIN) {
      this.problem.set('ADMIN.MODERATION.REASON_SHORT');
      return;
    }
    this.act(petId, this.service.blockDiary(petId, clean));
  }

  unhide(petId: string): void {
    this.act(petId, this.service.unblockDiary(petId));
  }

  reload(): void {
    this.load();
  }

  private act(petId: string, call: ReturnType<AdminService['unblockDiary']>): void {
    this.problem.set(null);
    this.busyId.set(petId);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busyId.set(null);
        this.hidingId.set(null);
        this.load();
      },
      error: (trouble: HttpErrorResponse) => {
        this.busyId.set(null);
        this.problem.set(trouble.status === 403 ? 'ADMIN.MODERATION.NO_RIGHT' : 'COMMON.GENERIC_ERROR');
      },
    });
  }

  private load(): void {
    this.status.set('LOADING');
    this.service
      .moderationList(this.tab(), this.keyword(), this.page())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (got) => {
          this.rows.set(got.rows);
          this.total.set(got.total);
          this.pageCount.set(got.pageCount);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }
}
