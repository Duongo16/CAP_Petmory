import { Router, RouterLink } from '@angular/router';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';
import { CatalogService } from '../../core/services/catalog.service';
import { AuthService } from '../../core/services/auth.service';
import {
  PendingReview,
  ProductReview,
  ProductSize,
  ProductType,
} from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';
import { Rating } from '../../shared/rating/rating';
import { Icon } from '../../shared/icon/icon';

/** The four panels of detail below the configurator. */
export type DetailTab = 'STORY' | 'PROCESS' | 'CARE' | 'REVIEWS';

/** Each panel with its label, written out so every key stays searchable. */
const TABS: { value: DetailTab; key: string }[] = [
  { value: 'STORY', key: 'PRODUCT.TAB_STORY' },
  { value: 'PROCESS', key: 'PRODUCT.TAB_PROCESS' },
  { value: 'CARE', key: 'PRODUCT.TAB_CARE' },
  { value: 'REVIEWS', key: 'PRODUCT.TAB_REVIEWS' },
];

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

@Component({
  selector: 'pm-product-detail-page',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslatePipe, MoneyPipe, Rating, Icon],
  templateUrl: './product-detail-page.html',
  styleUrl: './product-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailPage implements OnInit {
  /** Product type code from the URL, via the router's parameter binding. */
  readonly code = input.required<string>();

  /** Shown inside the shop popup, where the breadcrumb bar has nowhere to lead. */
  readonly inPopup = input(false);

  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly location = inject(Location);
  private readonly notification = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = this.auth.user;
  readonly status = signal<ScreenState>('LOADING');
  readonly product = signal<ProductType | null>(null);
  readonly sizeSelected = signal<ProductSize | null>(null);
  readonly quantity = signal(1);
  readonly favourite = signal(false);
  readonly descriptionOpen = signal(false);

  /** Which of the four panels below the configurator is open. */
  readonly tab = signal<DetailTab>('STORY');
  readonly tabs = TABS;


  readonly reviews = signal<ProductReview[]>([]);
  readonly reviewable = signal<PendingReview | null>(null);
  readonly draftRating = signal(0);
  readonly draftComment = signal('');
  readonly reviewSent = signal(false);

  readonly sizes = computed(() => this.product()?.sizes.filter((s) => s.enabled) ?? []);

  /**
   * The total is for display only. The server recalculates when the item is added,
   * so the number here never decides the order's value.
   */
  readonly total = computed(() => {
    const size = this.sizeSelected();
    if (!size) {
      return null;
    }
    const unitPrice = BigInt(size.price.$numberDecimal.split('.')[0]);
    return (unitPrice * BigInt(this.quantity())).toString();
  });


  readonly canReview = computed(() => this.reviewable() !== null && !this.reviewSent());
  readonly studioQuery = computed(() => ({ product: this.product()?.code ?? this.code() }));

  ngOnInit(): void {
    this.loadProduct();


    this.catalog
      .reviewsOf(this.code())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (list) => this.reviews.set(list), error: () => undefined });

    if (this.user()) {
      this.catalog
        .favouriteCodes()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (codes) => this.favourite.set(codes.includes(this.code().toUpperCase())),
          error: () => undefined,
        });

      this.catalog
        .pendingReviews()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (list) =>
            this.reviewable.set(
              list.find((r) => r.productTypeCode === this.code().toUpperCase()) ?? null,
            ),
          error: () => undefined,
        });
    }
  }

  back(): void {
    this.location.back();
  }

  selectSize(size: ProductSize): void {
    this.sizeSelected.set(size);
  }

  setTab(value: DetailTab): void {
    this.tab.set(value);
  }

  toggleDescription(): void {
    this.descriptionOpen.update((open) => !open);
  }


  toggleFavourite(): void {
    this.catalog
      .toggleFavourite(this.code())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.favourite.set(r.favourite), error: () => undefined });
  }

  /**
   * Hang tuy bien lam theo anh va ban thiet ke cua tung be (muc 7), nen khong
   * them thang vao gio: chuyen sang studio voi san pham, kich co va de da chon.
   */
  addToCart(): void {
    const product = this.product();
    const size = this.sizeSelected();
    if (!product || !size) {
      return;
    }
    void this.router.navigate(['/studio'], {
      queryParams: { product: product.code, size: size.code },
    });
  }

  sendReview(): void {
    const pending = this.reviewable();
    if (!pending || this.draftRating() < 1) {
      return;
    }
    this.catalog
      .writeReview({
        productTypeCode: pending.productTypeCode,
        orderCode: pending.orderCode,
        rating: this.draftRating(),
        comment: this.draftComment().trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.reviewSent.set(true);
          this.loadProduct();
          this.catalog
            .reviewsOf(this.code())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({ next: (list) => this.reviews.set(list), error: () => undefined });
        },
        error: () => this.openNotification('COMMON.GENERIC_ERROR'),
      });
  }

  /**
   * Shows a short message. The wording is looked up first, otherwise the bar
   * would print the naming of the phrase instead of the phrase itself.
   */
  private openNotification(key: string): void {
    this.translate
      .get(key)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((words) => this.notification.open(words, undefined, { duration: 2600 }));
  }

  private loadProduct(): void {
    this.catalog
      .productDetail(this.code())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => {
          this.product.set(product);
          if (!this.sizeSelected()) {
            this.sizeSelected.set(product.sizes.find((s) => s.enabled) ?? null);
          }
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }
}
