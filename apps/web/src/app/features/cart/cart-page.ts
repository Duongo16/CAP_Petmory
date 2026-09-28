import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { CartService } from '../../core/services/cart.service';
import { CartLine } from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

@Component({
  selector: 'pm-cart-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe, MoneyPipe],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPage implements OnInit {
  private readonly cartService = inject(CartService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly cart = this.cartService.cart;

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.status.set('LOADING');
    this.cartService
      .reload()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.status.set('READY'),
        error: () => this.status.set('ERROR'),
      });
  }

  changeQuantity(item: CartLine, step: number): void {
    const next = Math.min(99, Math.max(1, item.quantity + step));
    if (next === item.quantity) {
      return;
    }
    this.cartService.changeQuantity(item.id, next).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  remove(item: CartLine): void {
    this.cartService.removeItem(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
}
