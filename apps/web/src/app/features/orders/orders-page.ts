import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { OrderGroup, OrdersFacade, STAGE_KEYS } from './orders-facade';
import { MoneyPipe } from '../../shared/money.pipe';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'pm-orders-page',
  standalone: true,
  imports: [RouterLink, DatePipe, TranslatePipe, MoneyPipe, Icon],
  templateUrl: './orders-page.html',
  styleUrl: './orders-page.scss',
  providers: [OrdersFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersPage implements OnInit {
  private readonly facade = inject(OrdersFacade);

  readonly status = this.facade.status;
  readonly chips = this.facade.chips;
  readonly chosen = this.facade.chosen;
  readonly cards = this.facade.cards;
  readonly emptyGroup = this.facade.emptyGroup;

  readonly stageKeys = STAGE_KEYS;

  ngOnInit(): void {
    this.facade.load();
  }

  reload(): void {
    this.facade.load();
  }

  choose(group: OrderGroup): void {
    this.facade.choose(group);
  }
}
