import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { CatalogService } from '../../core/services/catalog.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductType } from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';
import { Icon } from '../../shared/icon/icon';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

/** How the grid may be ordered. */
type Ordering = 'POPULAR' | 'CHEAP' | 'DEAR';

/** One card in the grid, with everything the view needs already worked out. */
interface ProductCard {
  raw: ProductType;
  priceFrom: string | null;
  priceValue: bigint;
  sizeCount: number;
  favourite: boolean;
  badgeKey: string;
  badgeTone: string;
}

/**
 * The badge each card carries, in the order the cards appear.
 *
 * The design gives every product a short marketing badge. They belong to the
 * presentation rather than the catalogue, so they live here beside the tone
 * that colours them, with every key written out in full.
 */
const BADGES: { key: string; tone: string }[] = [
  { key: 'PRODUCT.BADGE.FLAGSHIP', tone: 'purple' },
  { key: 'PRODUCT.BADGE.POCKET', tone: 'green' },
  { key: 'PRODUCT.BADGE.DESK', tone: 'amber' },
  { key: 'PRODUCT.BADGE.FAMILY', tone: 'soft' },
  { key: 'PRODUCT.BADGE.KEEPSAKE', tone: 'purple' },
  { key: 'PRODUCT.BADGE.WEARABLE', tone: 'amber' },
];

/** The orderings offered, with their labels written out. */
const ORDERINGS: { value: Ordering; key: string }[] = [
  { value: 'POPULAR', key: 'PRODUCT.SORT.POPULAR' },
  { value: 'CHEAP', key: 'PRODUCT.SORT.CHEAP' },
  { value: 'DEAR', key: 'PRODUCT.SORT.DEAR' },
];

@Component({
  selector: 'pm-products-page',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslatePipe, MoneyPipe, Icon],
  templateUrl: './products-page.html',
  styleUrl: './products-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsPage implements OnInit {
  private readonly service = inject(CatalogService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = this.auth.user;
  readonly status = signal<ScreenState>('LOADING');
  readonly keyword = signal('');
  readonly ordering = signal<Ordering>('POPULAR');
  readonly orderings = ORDERINGS;

  private readonly list = signal<ProductType[]>([]);
  private readonly favourites = signal<string[]>([]);

  /** Each card carries its own figures, so the view calls no functions. */
  readonly cards = computed<ProductCard[]>(() => {
    const marked = this.favourites();
    const rows = this.list().map((raw, index) => {
      const badge = BADGES[index % BADGES.length];
      const cheapest = lowestPrice(raw);
      return {
        raw,
        priceFrom: cheapest,
        priceValue: cheapest ? BigInt(cheapest) : 0n,
        sizeCount: raw.sizes.filter((s) => s.enabled).length,
        favourite: marked.includes(raw.code),
        badgeKey: badge.key,
        badgeTone: badge.tone,
      };
    });
    return sortCards(rows, this.ordering());
  });

  /** How many pieces the workshop has made, read from the real review counts. */
  readonly reviewTotal = computed(() =>
    this.list().reduce((sum, p) => sum + (p.rating?.count ?? 0), 0),
  );

  /** The average score across everything that has been reviewed. */
  readonly scoreAverage = computed(() => {
    const scored = this.list().filter((p) => (p.rating?.count ?? 0) > 0);
    if (scored.length === 0) {
      return null;
    }
    const weighted = scored.reduce((sum, p) => sum + p.rating.average * p.rating.count, 0);
    const counted = scored.reduce((sum, p) => sum + p.rating.count, 0);
    return (weighted / counted).toFixed(1);
  });

  readonly empty = computed(() => this.status() === 'DONE' && this.list().length === 0);
  readonly searching = computed(() => this.keyword().trim().length > 0);

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.keyword.set(params.get('keyword') ?? '');
      this.load();
    });

    if (this.user()) {
      this.service
        .favouriteCodes()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (codes) => this.favourites.set(codes), error: () => undefined });
    }
  }

  load(): void {
    this.status.set('LOADING');
    this.service
      .searchProduct(this.keyword())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.list.set(list);
          this.status.set('DONE');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  setKeyword(value: string): void {
    this.keyword.set(value);
  }

  setOrdering(value: Ordering): void {
    this.ordering.set(value);
  }

  /** Putting the keyword in the address makes a search shareable and reloadable. */
  submitSearch(): void {
    const text = this.keyword().trim();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: text ? { keyword: text } : {},
    });
  }

  clearSearch(): void {
    this.keyword.set('');
    this.submitSearch();
  }

  toggleFavourite(card: ProductCard, event: Event): void {
    // The heart sits inside the card link, so the click must not also navigate.
    event.preventDefault();
    event.stopPropagation();
    this.service
      .toggleFavourite(card.raw.code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) =>
          this.favourites.update((codes) =>
            r.favourite ? [...codes, card.raw.code] : codes.filter((c) => c !== card.raw.code),
          ),
        error: () => undefined,
      });
  }
}

/** Orders the cards without changing the array the signal holds. */
function sortCards(rows: ProductCard[], ordering: Ordering): ProductCard[] {
  if (ordering === 'POPULAR') {
    return rows;
  }
  const byPrice = [...rows].sort((a, b) => (a.priceValue < b.priceValue ? -1 : 1));
  return ordering === 'CHEAP' ? byPrice : byPrice.reverse();
}

/**
 * The cheapest enabled size, shown as the "from" price. Amounts are compared as
 * whole numbers of dong so no rounding can creep in.
 */
function lowestPrice(product: ProductType): string | null {
  const price = product.sizes
    .filter((s) => s.enabled)
    .map((s) => BigInt(s.price.$numberDecimal.split('.')[0]));
  if (price.length === 0) {
    return null;
  }
  return price.reduce((a, b) => (a < b ? a : b)).toString();
}
