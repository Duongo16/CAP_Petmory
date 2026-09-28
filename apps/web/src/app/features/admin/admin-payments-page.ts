import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminService } from '../../core/services/admin.service';
import { TransferNotification } from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';
import { KEY_RESULT_RECONCILE } from '../../shared/order-status';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

const KEY_RESULT_OTHER = 'ADMIN.RECONCILE.OTHER';

@Component({
  selector: 'pm-admin-payments-page',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    MatProgressSpinnerModule,
    TranslatePipe,
    MoneyPipe,
  ],
  templateUrl: './admin-payments-page.html',
  styleUrl: './admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPaymentsPage implements OnInit {
  private readonly service = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly log = signal<TransferNotification[]>([]);
  readonly status = signal<ScreenState>('LOADING');

  readonly rows = computed(() =>
    this.log().map((t) => ({
      raw: t,
      keyResult: KEY_RESULT_RECONCILE[t.result] ?? KEY_RESULT_OTHER,
      match: t.result === 'MATCHED',
    })),
  );

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.status.set('LOADING');
    this.service
      .logPayment()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ds) => {
          this.log.set(ds);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }
}
