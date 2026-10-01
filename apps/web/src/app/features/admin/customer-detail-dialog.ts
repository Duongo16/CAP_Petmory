import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../core/services/admin.service';
import { CustomerProfile } from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';
import { Icon } from '../../shared/icon/icon';
import { KEY_STATUS_ORDER, GROUP_COLOR_STATUS } from '../../shared/order-status';
import { kindKeyOf } from '../../shared/pet-labels';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

const KEY_STATUS_PET: Record<string, string> = {
  TOGETHER: 'PET.TOGETHER',
  PASSED_AWAY: 'PET.PASSED_AWAY',
};

const COUNTS_AS_SPENT: string[] = ['PAID', 'IN_PRODUCTION', 'SHIPPING', 'COMPLETED'];
const COUNTS_AS_DONE: string[] = ['COMPLETED'];
const NEXT_TIER_AT = 1_000_000n;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

@Component({
  selector: 'pm-customer-detail-dialog',
  standalone: true,
  imports: [DatePipe, MatProgressSpinnerModule, TranslatePipe, MoneyPipe, Icon, RouterLink],
  templateUrl: './customer-detail-dialog.html',
  styleUrls: ['./admin-customer-detail-page.scss', './customer-detail-dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDetailDialog implements OnInit {
  private readonly service = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ref = inject<MatDialogRef<CustomerDetailDialog>>(MatDialogRef);
  readonly customerId = inject<string>(MAT_DIALOG_DATA);

  private readonly data = signal<CustomerProfile | null>(null);
  readonly status = signal<ScreenState>('LOADING');

  readonly customer = computed(() => this.data()?.customer ?? null);

  readonly pets = computed(() =>
    (this.data()?.pet ?? []).map((t) => ({
      raw: t,
      keyStatus: KEY_STATUS_PET[t.status] ?? 'PET.TOGETHER',
      keyKind: kindKeyOf(t.kind),
    })),
  );

  readonly orders = computed(() =>
    (this.data()?.orders ?? []).map((d) => ({
      raw: d,
      keyStatus: KEY_STATUS_ORDER[d.status],
      groupColor: GROUP_COLOR_STATUS[d.status],
    })),
  );

  readonly initials = computed(() => initialsOf(this.customer()?.fullName ?? ''));

  private readonly spent = computed(() =>
    (this.data()?.orders ?? [])
      .filter((d) => COUNTS_AS_SPENT.includes(d.status))
      .reduce((total, d) => total + BigInt(d.total.$numberDecimal), 0n),
  );

  readonly spentText = computed(() => this.spent().toString());
  readonly orderCount = computed(() => (this.data()?.orders ?? []).length);
  readonly petCount = computed(() => (this.data()?.pet ?? []).length);

  readonly doneCount = computed(
    () => (this.data()?.orders ?? []).filter((d) => COUNTS_AS_DONE.includes(d.status)).length,
  );

  readonly tierShare = computed(() => {
    const share = (this.spent() * 100n) / NEXT_TIER_AT;
    return Number(share > 100n ? 100n : share);
  });

  readonly phone = computed(() => (this.data()?.orders ?? [])[0]?.delivery.phone ?? '');

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.status.set('LOADING');
    this.service
      .customerProfile(this.customerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (kq) => {
          this.data.set(kq);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  close(): void {
    this.ref.close();
  }
}
