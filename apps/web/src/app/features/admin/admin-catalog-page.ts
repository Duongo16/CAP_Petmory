import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CatalogKind } from '../../core/services/catalog-admin.service';
import { CatalogItemsPanel } from './catalog/catalog-items-panel';
import { CatalogProductsPanel } from './catalog/catalog-products-panel';

type CatalogTab = 'PRODUCTS' | CatalogKind;

const TABS: { code: CatalogTab; key: string }[] = [
  { code: 'PRODUCTS', key: 'ADMIN.CATALOG.TAB_PRODUCTS' },
  { code: 'display-bases', key: 'ADMIN.CATALOG.TAB_BASES' },
  { code: 'accessories', key: 'ADMIN.CATALOG.TAB_ACCESSORIES' },
  { code: 'packaging', key: 'ADMIN.CATALOG.TAB_PACKAGING' },
];

/**
 * Danh muc san pham va vat lieu (muc 12, 13): loai san pham va kich co, de,
 * phu kien, hop va khung. Bang ma mau len nam o trang Tham so.
 */
@Component({
  selector: 'pm-admin-catalog-page',
  standalone: true,
  imports: [TranslatePipe, CatalogItemsPanel, CatalogProductsPanel],
  templateUrl: './admin-catalog-page.html',
  styleUrls: ['./admin-shared.scss', './admin-catalog-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCatalogPage {
  readonly tab = signal<CatalogTab>('PRODUCTS');
  readonly tabs = computed(() => TABS.map((one) => ({ ...one, on: one.code === this.tab() })));
  readonly itemKind = computed<CatalogKind | null>(() => (this.tab() === 'PRODUCTS' ? null : (this.tab() as CatalogKind)));

  pick(code: CatalogTab): void {
    this.tab.set(code);
  }
}
