import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationStart, Router } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import { ProductsPage } from '../catalog/products-page';
import { GoodsListPage } from '../goods/goods-list-page';
import { ShopDetailDialog, ShopDetailRequest } from './shop-detail-dialog';

type Shelf = 'custom' | 'ready';

/** Leaving the shop closes the popup with this, so the address is not rewritten behind it. */
const LEFT = 'LEFT';

/**
 * The shop: keepsakes made from a pet's photographs and ready-made goods,
 * side by side under two tabs. An item opens as a popup over the list, and the
 * address names it so a link or the back button finds it again.
 */
@Component({
  selector: 'pm-shop-page',
  standalone: true,
  imports: [TranslatePipe, Icon, ProductsPage, GoodsListPage],
  templateUrl: './shop-page.html',
  styleUrl: './shop-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly shelf = signal<Shelf>('custom');

  private open: { key: string; ref: MatDialogRef<ShopDetailDialog, string> } | null = null;

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.shelf.set(params.get('tab') === 'ready' ? 'ready' : 'custom');
      const product = params.get('product');
      const goods = params.get('goods');
      const wanted: ShopDetailRequest | null = product
        ? { kind: 'PRODUCT', code: product }
        : goods
          ? { kind: 'GOODS', code: goods }
          : null;
      this.show(wanted);
    });

    // A link inside the popup that leads out of the shop takes the popup with it.
    this.router.events
      .pipe(
        filter((event): event is NavigationStart => event instanceof NavigationStart),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        if (this.open && !event.url.startsWith('/shop')) {
          this.open.ref.close(LEFT);
        }
      });
  }

  pickShelf(shelf: Shelf): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: shelf } });
  }

  private show(wanted: ShopDetailRequest | null): void {
    const key = wanted ? `${wanted.kind}:${wanted.code}` : '';
    if (this.open?.key === key) {
      return;
    }
    this.open?.ref.close(LEFT);
    this.open = null;
    if (!wanted) {
      return;
    }
    const ref = this.dialog.open<ShopDetailDialog, ShopDetailRequest, string>(ShopDetailDialog, {
      data: wanted,
      width: 'min(1120px, 96vw)',
      maxHeight: '92vh',
      panelClass: ['pm-dialog', 'pm-dialog-wide'],
      autoFocus: 'dialog',
    });
    this.open = { key, ref };
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((why) => {
        if (this.open?.ref === ref) {
          this.open = null;
        }
        if (why !== LEFT) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { product: null, goods: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      });
  }
}
