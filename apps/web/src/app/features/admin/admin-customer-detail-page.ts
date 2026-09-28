import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminService } from '../../core/services/admin.service';
import { CustomerProfile } from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';
import { KEY_STATUS_ORDER, GROUP_COLOR_STATUS } from '../../shared/order-status';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

const KEY_STATUS_PET: Record<string, string> = {
  TOGETHER: 'PET.TOGETHER',
  PASSED_AWAY: 'PET.PASSED_AWAY',
};

@Component({
  selector: 'pm-admin-customer-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    MatProgressSpinnerModule,
    TranslatePipe,
    MoneyPipe,
  ],
  templateUrl: './admin-customer-detail-page.html',
  styleUrl: './admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCustomerDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly data = signal<CustomerProfile | null>(null);
  readonly status = signal<ScreenState>('LOADING');

  readonly customer = computed(() => this.data()?.customer ?? null);

  readonly pets = computed(() =>
    (this.data()?.pet ?? []).map((t) => ({
      raw: t,
      keyStatus: KEY_STATUS_PET[t.status] ?? 'PET.TOGETHER',
    })),
  );

  readonly orders = computed(() =>
    (this.data()?.orders ?? []).map((d) => ({
      raw: d,
      keyStatus: KEY_STATUS_ORDER[d.status],
      groupColor: GROUP_COLOR_STATUS[d.status],
    })),
  );

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.status.set('LOADING');
    this.service
      .customerProfile(this.route.snapshot.paramMap.get('id') ?? '')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (kq) => {
          this.data.set(kq);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }
}
