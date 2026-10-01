import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { CartFacade } from './cart-facade';
import { CartLine } from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';
import { Icon } from '../../shared/icon/icon';

/** One tile of the workshop timeline, with its wording and colour written out. */
interface CraftStep {
  step: string;
  name: string;
  note: string;
  tone: string;
}

const CRAFT_STEPS: CraftStep[] = [
  { step: 'CART.CRAFT.STEP_1', name: 'CART.CRAFT.NAME_1', note: 'CART.CRAFT.NOTE_1', tone: 'purple' },
  { step: 'CART.CRAFT.STEP_2', name: 'CART.CRAFT.NAME_2', note: 'CART.CRAFT.NOTE_2', tone: 'purple' },
  { step: 'CART.CRAFT.STEP_3', name: 'CART.CRAFT.NAME_3', note: 'CART.CRAFT.NOTE_3', tone: 'amber' },
  { step: 'CART.CRAFT.STEP_4', name: 'CART.CRAFT.NAME_4', note: 'CART.CRAFT.NOTE_4', tone: 'green' },
];

/** The three promises printed under the order button. */
const PROMISES: string[] = ['CART.PROMISE_CHECK', 'CART.PROMISE_WARRANTY', 'CART.PROMISE_GIFT'];

@Component({
  selector: 'pm-cart-page',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslatePipe, MoneyPipe, Icon],
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
  readonly suggestions = this.facade.suggestions;
  readonly voucherCode = this.facade.voucherCode;
  readonly voucherRejected = this.facade.voucherRejected;

  readonly craftSteps = CRAFT_STEPS;
  readonly promises = PROMISES;

  ngOnInit(): void {
    this.facade.load();
  }

  reload(): void {
    this.facade.load();
  }

  changeQuantity(item: CartLine, step: number): void {
    this.facade.changeQuantity(item, step);
  }

  remove(item: CartLine): void {
    this.facade.remove(item);
  }

  setVoucher(code: string): void {
    this.facade.setVoucher(code);
  }

  applyVoucher(): void {
    this.facade.applyVoucher();
  }
}
