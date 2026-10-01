import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminService } from '../../core/services/admin.service';
import { CustomerRow } from '../../core/models/api.model';
import { CustomerDetailDialog } from './customer-detail-dialog';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

const SHEET = { width: 'min(640px, 96vw)', maxHeight: '92vh', panelClass: 'pm-dialog' };

@Component({
  selector: 'pm-admin-customers-page',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './admin-customers-page.html',
  styleUrl: './admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCustomersPage implements OnInit {
  private readonly service = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);

  readonly status = signal<ScreenState>('LOADING');
  readonly rows = signal<CustomerRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageCount = signal(1);
  readonly keyword = signal('');

  readonly pageRange = computed<(number | null)[]>(() => {
    const total = this.pageCount();
    const cur = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | null)[] = [1];
    if (cur > 3) pages.push(null);
    for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) pages.push(p);
    if (cur < total - 2) pages.push(null);
    pages.push(total);
    return pages;
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.status.set('LOADING');
    this.service
      .listCustomers(this.keyword(), this.page())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (kq) => {
          this.rows.set(kq.rows);
          this.total.set(kq.total);
          this.pageCount.set(kq.pageCount);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  search(text: string): void {
    this.keyword.set(text.trim());
    this.page.set(1);
    this.reload();
  }

  changePage(step: number): void {
    const next = this.page() + step;
    if (next < 1 || next > this.pageCount()) return;
    this.page.set(next);
    this.reload();
  }

  goToPage(num: number): void {
    if (num === this.page()) return;
    this.page.set(num);
    this.reload();
  }

  openDetail(id: string): void {
    this.dialog.open(CustomerDetailDialog, { ...SHEET, data: id });
  }
}
