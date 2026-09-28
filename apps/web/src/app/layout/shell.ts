import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../core/services/auth.service';
import { CartService } from '../core/services/cart.service';
import { ChatWidget } from '../shared/chat-widget/chat-widget';
import { SocialLinks } from '../shared/social-links/social-links';
import { Icon } from '../shared/icon/icon';

interface MenuItem {
  path: string;
  key: string;
}

@Component({
  selector: 'pm-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    TranslatePipe,
    ChatWidget,
    SocialLinks,
    Icon,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = this.auth.user;
  readonly cartItemCount = this.cart.countItem;
  readonly isInternal = this.auth.isInternal;
  readonly isOperations = this.auth.isOperations;

  /** What the header search box currently holds. */
  readonly keyword = signal('');

  /** First letter of the display name, used as a stand-in avatar. */
  readonly initial = computed(() => this.user()?.fullName?.trim().charAt(0).toUpperCase() ?? '?');

  /** Whether the account menu is open. */
  readonly menuOpen = signal(false);

  /** The four shop destinations that stay visible in the bar. */
  readonly menu: MenuItem[] = [
    { path: '/home', key: 'NAV.HOME' },
    { path: '/products', key: 'NAV.PRODUCT' },
    { path: '/studio', key: 'NAV.STUDIO' },
    { path: '/community', key: 'NAV.COMMUNITY' },
  ];

  /** Personal destinations, kept behind the account button so the bar stays on one line. */
  readonly accountMenu: MenuItem[] = [
    { path: '/orders', key: 'NAV.ORDER' },
    { path: '/pets', key: 'NAV.PET' },
    { path: '/colors', key: 'NAV.PALETTE' },
  ];

  /** The footer lists everything, since it has the room. */
  readonly footerMenu: MenuItem[] = [...this.menu, ...this.accountMenu];

  /** Shown to internal staff only. The server re-checks permission on every request. */
  readonly internalMenu: MenuItem[] = [
    { path: '/admin/orders', key: 'NAV.DISPATCH_ORDER' },
    { path: '/admin/customers', key: 'NAV.CUSTOMER' },
    { path: '/admin/payment-log', key: 'NAV.LOG_PAYMENT' },
  ];

  /** The settings page is open to the two operations groups, not to support. */
  readonly operationsMenu: MenuItem[] = [
    { path: '/admin/materials', key: 'NAV.MATERIAL' },
    { path: '/admin/settings', key: 'NAV.SETTINGS' },
  ];

  ngOnInit(): void {
    this.cart.reload().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
  }

  /** Sends the keyword to the product list, which owns the search results. */
  submitSearch(): void {
    const text = this.keyword().trim();
    void this.router.navigate(['/products'], {
      queryParams: text ? { keyword: text } : {},
    });
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  logout(): void {
    this.closeMenu();
    this.cart.reset();
    this.auth.logout();
  }
}
