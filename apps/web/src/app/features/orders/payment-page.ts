import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { PaymentFacade } from './payment-facade';
import { OrderSteps } from './order-steps/order-steps';
import { MoneyPipe } from '../../shared/money.pipe';
import { Icon } from '../../shared/icon/icon';

/** How long the copy button keeps saying that it worked. */
const COPIED_FOR_MS = 2000;

@Component({
  selector: 'pm-payment-page',
  standalone: true,
  imports: [RouterLink, DatePipe, TranslatePipe, MoneyPipe, Icon, OrderSteps],
  templateUrl: './payment-page.html',
  styleUrl: './payment-page.scss',
  providers: [PaymentFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentPage implements OnInit, OnDestroy {
  readonly orderCode = input.required<string>();

  private readonly facade = inject(PaymentFacade);
  private forgetCopied: ReturnType<typeof setTimeout> | null = null;

  readonly status = this.facade.status;
  readonly payment = this.facade.payment;
  readonly paidOrder = this.facade.paidOrder;
  readonly paid = this.facade.paid;
  readonly copied = this.facade.copied;
  readonly countdown = this.facade.countdown;
  readonly expired = this.facade.expired;
  readonly checkingNow = this.facade.checkingNow;

  ngOnInit(): void {
    this.facade.start(this.orderCode());
  }

  ngOnDestroy(): void {
    if (this.forgetCopied !== null) {
      clearTimeout(this.forgetCopied);
    }
  }

  /** Copies a value so the customer can paste it into their banking app. */
  async copy(value: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    this.facade.markCopied(label);
    if (this.forgetCopied !== null) {
      clearTimeout(this.forgetCopied);
    }
    this.forgetCopied = setTimeout(() => this.facade.markCopied(null), COPIED_FOR_MS);
  }

  checkNow(): void {
    this.facade.checkNow();
  }
}
