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
import { Rating } from '../../shared/rating/rating';
import { Icon } from '../../shared/icon/icon';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

/** One card in the grid, with everything the view needs already worked out. */
interface ProductCard {
  raw: ProductType;
  priceFrom: string | null;
  sizeCount: number;
  favourite: boolean;
}

@Component({
  selector: 'pm-products-page',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslatePipe, MoneyPipe, Rating, Icon],
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

  private readonly list = signal<ProductType[]>([]);
  private readonly favourites = signal<string[]>([]);

  /** Each card carries its own figures, so the view calls no functions. */
  readonly cards = computed<ProductCard[]>(() => {
    const marked = this.favourites();
    return this.list().map((raw) => ({
      raw,
      priceFrom: lowestPrice(raw),
      sizeCount: raw.sizes.filter((s) => s.enabled).length,
      favourite: marked.includes(raw.code),
    }));
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
