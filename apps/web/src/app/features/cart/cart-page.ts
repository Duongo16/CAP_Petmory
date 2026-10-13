import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CartFacade } from './cart-facade';
import { CartLine } from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';
import { DesignPreview } from '../../shared/design-preview/design-preview';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'pm-cart-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe, MoneyPipe, Icon, DesignPreview],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.scss',
  providers: [CartFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPage implements OnInit {
  private readonly facade = inject(CartFacade);

  readonly status = this.facade.status;
  readonly cart = this.facade.cart;
  readonly cards = this.facade.cards;
  readonly empty = this.facade.empty;
  readonly problem = this.facade.problem;

  readonly isAllSelected = this.facade.isAllSelected;
  readonly isSomeSelected = this.facade.isSomeSelected;
  readonly selectedCount = this.facade.selectedCount;
  readonly selectedLinesCount = this.facade.selectedLinesCount;
  readonly selectedTotal = this.facade.selectedTotal;
  readonly selectedDaysMax = this.facade.selectedDaysMax;
  readonly canCheckout = this.facade.canCheckout;
  readonly checkoutQueryParams = this.facade.checkoutQueryParams;

  ngOnInit(): void {
    this.facade.load();
  }

  reload(): void {
    this.facade.load();
  }

  toggleSelect(id: string): void {
    this.facade.toggleSelect(id);
  }

  toggleAll(): void {
    this.facade.toggleAll();
  }

  removeSelected(): void {
    this.facade.removeSelected();
  }

  changeQuantity(item: CartLine, step: number): void {
    this.facade.changeQuantity(item, step);
  }

  remove(item: CartLine): void {
    this.facade.remove(item);
  }

}
