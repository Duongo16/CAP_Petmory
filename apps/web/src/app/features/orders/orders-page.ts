import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DOCUMENT, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { OrderGroup, OrdersFacade } from './orders-facade';
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
  private readonly document = inject(DOCUMENT);

  readonly status = this.facade.status;
  readonly chips = this.facade.chips;
  readonly chosen = this.facade.chosen;
  readonly cards = this.facade.cards;
  readonly emptyGroup = this.facade.emptyGroup;
  readonly asking = this.facade.asking;
  readonly cancelling = this.facade.cancelling;
  readonly cancelProblem = this.facade.cancelProblem;

  ngOnInit(): void {
    this.facade.load();
  }

  reload(): void {
    this.facade.load();
  }

  choose(group: OrderGroup): void {
    this.facade.choose(group);
  }

  cancel(orderCode: string): void {
    this.facade.cancel(orderCode);
  }

  /**
   * Truot tu tu xuong cot lien he o chan trang (Facebook, TikTok, Zalo).
   *
   * Tu ve tung khung hinh thay vi dung scrollIntoView smooth, vi trinh duyet bo
   * qua hieu ung do khi may tat hoat anh, va man hinh se nhay thang xuong.
   */
  goToContact(): void {
    const view = this.document.defaultView;
    const target = this.document.getElementById('footer-contact');
    if (!view || !target) {
      return;
    }
    const box = target.getBoundingClientRect();
    const from = view.scrollY;
    const room = this.document.documentElement.scrollHeight - view.innerHeight;
    const to = Math.min(room, Math.max(0, from + box.top - (view.innerHeight - box.height) / 2));
    const distance = to - from;
    const duration = Math.min(1400, Math.max(600, Math.abs(distance) * 0.6));
    const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    let start = 0;

    const step = (now: number) => {
      start ||= now;
      const progress = Math.min(1, (now - start) / duration);
      view.scrollTo({ top: from + distance * easeInOut(progress), behavior: 'instant' });
      if (progress < 1) {
        view.requestAnimationFrame(step);
      } else {
        target.focus({ preventScroll: true });
      }
    };
    view.requestAnimationFrame(step);
  }
}
