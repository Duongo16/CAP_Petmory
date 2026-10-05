import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminService } from '../../core/services/admin.service';
import { AuditEntry } from '../../core/models/api.model';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

/**
 * Nhat ky thao tac (muc 14): ai lam gi, tren tai nguyen nao, luc nao, gia tri
 * truoc va sau. Chi doc; nhat ky khong sua hay xoa duoc tu bat ky man hinh nao.
 */
@Component({
  selector: 'pm-admin-audit-page',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, TranslatePipe],
  templateUrl: './admin-audit-page.html',
  styleUrls: ['./admin-shared.scss', './admin-audit-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuditPage implements OnInit {
  private readonly service = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly rows = signal<AuditEntry[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageCount = signal(1);
  readonly openId = signal<string | null>(null);
  readonly resourceTypes = signal<string[]>([]);
  readonly actions = signal<string[]>([]);

  readonly filter = new FormGroup({
    resourceType: new FormControl('', { nonNullable: true }),
    action: new FormControl('', { nonNullable: true }),
    resourceId: new FormControl('', { nonNullable: true }),
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
  });

  /** Dong da chuan bi san: du lieu truoc va sau doi ra chu de doc, khong goi ham trong khung nhin. */
  readonly view = computed(() =>
    this.rows().map((one) => ({
      raw: one,
      who: one.actor ? `${one.actor.fullName} · ${one.actor.email}` : '',
      beforeText: one.before ? JSON.stringify(one.before, null, 2) : '',
      afterText: one.after ? JSON.stringify(one.after, null, 2) : '',
      open: this.openId() === one._id,
    })),
  );

  ngOnInit(): void {
    this.service
      .auditFacets()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (got) => {
          this.resourceTypes.set(got.resourceType);
          this.actions.set(got.action);
        },
        error: () => undefined,
      });
    this.load();
  }

  search(): void {
    this.page.set(1);
    this.load();
  }

  reset(): void {
    this.filter.reset();
    this.search();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  toggle(id: string): void {
    this.openId.set(this.openId() === id ? null : id);
  }

  load(): void {
    const value = this.filter.getRawValue();
    this.status.set('LOADING');
    this.service
      .auditLog({
        ...value,
        // Ngay den tinh tron ca ngay do.
        from: value.from ? new Date(`${value.from}T00:00:00`).toISOString() : '',
        to: value.to ? new Date(`${value.to}T23:59:59`).toISOString() : '',
        page: this.page(),
      })
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
