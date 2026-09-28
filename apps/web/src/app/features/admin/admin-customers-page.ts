import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminService } from '../../core/services/admin.service';
import { CustomerRow } from '../../core/models/api.model';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

@Component({
  selector: 'pm-admin-customers-page',
  standalone: true,
  imports: [
    RouterLink,
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

  readonly status = signal<ScreenState>('LOADING');
  readonly rows = signal<CustomerRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageCount = signal(1);
  readonly keyword = signal('');

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
    if (next < 1 || next > this.pageCount()) {
      return;
    }
    this.page.set(next);
    this.reload();
  }
}
