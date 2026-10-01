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
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { GoodsService } from '../../core/services/goods.service';
import { Goods, GoodsCategory, GoodsPage } from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';
import { Icon } from '../../shared/icon/icon';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

const NOTHING: GoodsPage = { rows: [], total: 0, page: 1, pageCount: 1 };

/** Ba cach sap xep, viet san de khong bao gio ghep chuoi thanh khoa. */
const SORT_CHOICES = [
  { value: '', key: 'GOODS.SORT_NEW' },
  { value: 'PRICE_UP', key: 'GOODS.SORT_PRICE_UP' },
  { value: 'PRICE_DOWN', key: 'GOODS.SORT_PRICE_DOWN' },
];

/** Mot mon hang da tinh san nhung gi the hang can hien. */
export interface GoodsCard {
  raw: Goods;
  image: string;
  fromPrice: string;
  inStock: number;
  soldOut: boolean;
}

/**
 * Danh muc hang co san.
 *
 * Dong hang nay khong gan voi anh hay ban thiet ke cua be, nen luong mua la
 * luong rut gon: xem, chon to hop, bo vao gio.
 */
@Component({
  selector: 'pm-goods-list-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, MoneyPipe, Icon],
  templateUrl: './goods-list-page.html',
  styleUrl: './goods-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoodsListPage implements OnInit {
  private readonly service = inject(GoodsService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly answer = signal<GoodsPage>(NOTHING);
  readonly groups = signal<GoodsCategory[]>([]);
  readonly group = signal('');
  readonly sort = signal('');

  readonly sorts = SORT_CHOICES;
  readonly form = this.fb.nonNullable.group({ keyword: [''] });

  readonly page = computed(() => this.answer().page);
  readonly pageCount = computed(() => this.answer().pageCount);
  readonly total = computed(() => this.answer().total);

  /** Moi mon hang kem gia thap nhat va tong so hang dang co. */
  readonly cards = computed<GoodsCard[]>(() =>
    this.answer().rows.map((raw) => {
      const live = raw.variant.filter((one) => one.enabled);
      const prices = live.map((one) => Number(one.price.$numberDecimal));
      const inStock = live.reduce((sum, one) => sum + one.stock, 0);
      return {
        raw,
        image: raw.images[0] ?? '',
        fromPrice: prices.length > 0 ? String(Math.min(...prices)) : '0',
        inStock,
        soldOut: inStock === 0,
      };
    }),
  );

  ngOnInit(): void {
    forkJoin({ groups: this.service.categories(), rows: this.service.list() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (both) => {
          this.groups.set(both.groups);
          this.answer.set(both.rows);
          this.status.set('DONE');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  chooseGroup(code: string): void {
    this.group.set(code);
    this.read(1);
  }

  chooseSort(event: Event): void {
    this.sort.set((event.target as HTMLSelectElement).value);
    this.read(1);
  }

  search(): void {
    this.read(1);
  }

  changePage(step: number): void {
    const next = Math.min(this.pageCount(), Math.max(1, this.page() + step));
    if (next !== this.page()) {
      this.read(next);
    }
  }

  private read(page: number): void {
    this.status.set('LOADING');
    this.service
      .list({
        page,
        category: this.group() || undefined,
        keyword: this.form.getRawValue().keyword.trim() || undefined,
        sort: this.sort() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (fresh) => {
          this.answer.set(fresh);
          this.status.set('DONE');
        },
        error: () => this.status.set('ERROR'),
      });
  }
}
