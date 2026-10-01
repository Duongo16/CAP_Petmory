import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import { ProductDetailPage } from '../catalog/product-detail-page';
import { GoodsDetailPage } from '../goods/goods-detail-page';

/** Which shelf of the shop the item comes from, and its code. */
export interface ShopDetailRequest {
  kind: 'PRODUCT' | 'GOODS';
  code: string;
}

/** One item's full detail, opened over the shop instead of on a page of its own. */
@Component({
  selector: 'pm-shop-detail-dialog',
  standalone: true,
  imports: [TranslatePipe, Icon, ProductDetailPage, GoodsDetailPage],
  templateUrl: './shop-detail-dialog.html',
  styleUrl: './shop-detail-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopDetailDialog {
  readonly data = inject<ShopDetailRequest>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ShopDetailDialog>);

  close(): void {
    this.ref.close();
  }
}
