import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CartDesign, CartLine, ProductType } from '../../core/models/api.model';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

/** One line of the cart with everything the card needs already worked out. */
export interface CartCard {
  raw: CartLine;
  lineTotal: string;
  sizeName: string;
  imageUrl: string | null;
  productLink: string[];
  productQuery: Record<string, string | undefined>;
  /** Dong hang co san hay dong hang lam theo anh cua be. */
  readyMade: boolean;
  selected: boolean;
  /** Ban thiet ke cua dong hang, rong voi hang co san va hang khong kem thiet ke. */
  design: CartDesign | null;
  /** Mo lai ban thiet ke trong ban len 3D. */
  designQuery: Record<string, string> | null;
}

/**
 * Holds the cart and every change the screen makes.
 * The component only reads signals and issues commands, keeping no state of its own.
 */
@Injectable()
export class CartFacade {
  private readonly cartService = inject(CartService);
  private readonly catalogService = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<ScreenState>('LOADING');
  private readonly products = signal<ProductType[]>([]);
  private readonly lineTrouble = signal<string | null>(null);
  private readonly selectedIds = signal<Set<string>>(new Set());

  readonly status = this.state.asReadonly();
  readonly cart = this.cartService.cart;
  /** Mot dong khong doi duoc so luong hay khong bo duoc, noi ngay tren trang. */
  readonly problem = this.lineTrouble.asReadonly();

  readonly empty = computed(() => this.cart().items.length === 0);

  readonly cards = computed<CartCard[]>(() => {
    const byCode = new Map(this.products().map((p) => [p.code, p]));
    const selected = this.selectedIds();
    return this.cart().items.map((raw) => {
      const isSelected = selected.has(raw.id);
      /*
       * Hang co san mang san anh va ten day du trong chinh dong hang, nen
       * khong phai tra cuu danh muc hang tuy bien de biet no la gi.
       */
      if (raw.kind === 'READY_MADE') {
        return {
          raw,
          lineTotal: (BigInt(raw.unitPrice) * BigInt(raw.quantity)).toString(),
          sizeName: raw.sku,
          imageUrl: raw.imageUrl || null,
          productLink: ['/shop'],
          productQuery: { tab: 'ready', goods: raw.goodsCode ?? '' },
          readyMade: true,
          selected: isSelected,
          design: null,
          designQuery: null,
        };
      }
      const product = byCode.get(raw.productTypeCode);
      const size = product?.sizes.find((one) => one.code === raw.sizeCode);
      return {
        raw,
        lineTotal: (BigInt(raw.unitPrice) * BigInt(raw.quantity)).toString(),
        sizeName: size ? `${size.displayName} (${size.dimensions})` : raw.sizeCode,
        imageUrl: product?.imageUrl ?? null,
        productLink: ['/shop'],
        productQuery: { tab: 'custom', product: raw.productTypeCode ?? '' },
        readyMade: false,
        selected: isSelected,
        design: raw.design,
        designQuery: raw.design && !raw.design.missing ? { draft: raw.design.id } : null,
      };
    });
  });

  readonly selectedCards = computed<CartCard[]>(() => {
    return this.cards().filter((c) => c.selected);
  });

  readonly isAllSelected = computed(() => {
    const all = this.cards();
    return all.length > 0 && all.every((c) => c.selected);
  });

  readonly isSomeSelected = computed(() => {
    const all = this.cards();
    const count = this.selectedLinesCount();
    return count > 0 && count < all.length;
  });

  readonly selectedLinesCount = computed(() => this.selectedCards().length);

  readonly selectedCount = computed(() => {
    return this.selectedCards().reduce((acc, c) => acc + c.raw.quantity, 0);
  });

  readonly selectedTotal = computed(() => {
    let sum = 0n;
    for (const card of this.selectedCards()) {
      sum += BigInt(card.raw.unitPrice) * BigInt(card.raw.quantity);
    }
    return sum.toString();
  });

  readonly selectedDaysMax = computed(() => {
    let max = 0;
    for (const card of this.selectedCards()) {
      max = Math.max(max, card.raw.productionDays);
    }
    return max;
  });

  readonly canCheckout = computed(() => this.selectedCards().length > 0);

  readonly checkoutQueryParams = computed<Record<string, string | undefined>>(() => {
    const ids = this.selectedCards().map((c) => c.raw.id);
    return ids.length > 0 ? { items: ids.join(',') } : {};
  });

  load(): void {
    this.state.set('LOADING');
    forkJoin({
      cart: this.cartService.reload(),
      products: this.catalogService.product$.pipe(catchError(() => of<ProductType[]>([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (both) => {
          this.products.set(both.products);
          this.selectedIds.set(new Set(both.cart.items.map((i) => i.id)));
          this.state.set('DONE');
        },
        error: () => this.state.set('ERROR'),
      });
  }

  toggleSelect(id: string): void {
    const current = new Set(this.selectedIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedIds.set(current);
  }

  toggleAll(): void {
    if (this.isAllSelected()) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(this.cart().items.map((i) => i.id)));
    }
  }

  removeSelected(): void {
    const toRemove = Array.from(this.selectedIds());
    if (toRemove.length === 0) {
      return;
    }
    this.lineTrouble.set(null);
    forkJoin(toRemove.map((id) => this.cartService.removeItem(id)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const next = new Set(this.selectedIds());
          for (const id of toRemove) {
            next.delete(id);
          }
          this.selectedIds.set(next);
        },
        error: () => this.lineTrouble.set('COMMON.GENERIC_ERROR'),
      });
  }

  changeQuantity(item: CartLine, step: number): void {
    const next = Math.min(99, Math.max(1, item.quantity + step));
    if (next === item.quantity) {
      return;
    }
    this.lineTrouble.set(null);
    this.cartService
      .changeQuantity(item.id, next)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (trouble: { status?: number }) =>
          this.lineTrouble.set(trouble.status === 400 ? 'CART.NOT_ENOUGH' : 'COMMON.GENERIC_ERROR'),
      });
  }

  remove(item: CartLine): void {
    this.lineTrouble.set(null);
    this.cartService
      .removeItem(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const next = new Set(this.selectedIds());
          next.delete(item.id);
          this.selectedIds.set(next);
        },
        error: () => this.lineTrouble.set('COMMON.GENERIC_ERROR'),
      });
  }

}
