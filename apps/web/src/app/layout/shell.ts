import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../core/services/auth.service';
import { CartService } from '../core/services/cart.service';
import { ChatWidget } from '../shared/chat-widget/chat-widget';
import { SocialLinks } from '../shared/social-links/social-links';
import { Icon } from '../shared/icon/icon';
import { ThemeToggle } from '../shared/theme-toggle/theme-toggle';
import { LanguageToggle } from '../shared/language-toggle/language-toggle';
import { BottomNav } from './bottom-nav/bottom-nav';

interface MenuItem {
  path: string;
  key: string;
}
import { Brand } from '../shared/brand/brand';
import { UserFace } from '../shared/user-face/user-face';

/** Tuyen sau nhat dang mo. */
function deepest(root: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  let route = root;
  while (route.firstChild) {
    route = route.firstChild;
  }
  return route;
}

/** Doc co danh dau man hinh tran khung o tuyen sau nhat dang mo. */
function isImmersive(root: ActivatedRouteSnapshot): boolean {
  return deepest(root).data['immersive'] === true;
}

/**
 * Man co nut hanh dong chinh sat day man hinh (gio hang, thanh toan, ban len 3D).
 * Tren dien thoai nut tro ly se an o cac man nay de khong che nut do.
 */
const QUIET_CHAT_PATHS = ['cart', 'checkout', 'studio'];

function isQuietChat(root: ActivatedRouteSnapshot): boolean {
  return QUIET_CHAT_PATHS.includes(deepest(root).routeConfig?.path ?? '');
}

@Component({
  selector: 'pm-shell',
  standalone: true,
  imports: [UserFace, 
    Brand,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    ChatWidget,
    SocialLinks,
    Icon,
    ThemeToggle,
    LanguageToggle,
    BottomNav,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);

  /** Man hinh tran khung, nhu ban len 3D, thi khong hien chan trang. */
  readonly immersive = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => isImmersive(this.router.routerState.snapshot.root)),
    ),
    { initialValue: isImmersive(this.router.routerState.snapshot.root) },
  );

  /** Man co nut chinh o day man hinh: an nut tro ly tren dien thoai. */
  readonly quietChat = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => isQuietChat(this.router.routerState.snapshot.root)),
    ),
    { initialValue: isQuietChat(this.router.routerState.snapshot.root) },
  );

  readonly user = this.auth.user;
  readonly cartItemCount = this.cart.countItem;
  readonly isInternal = this.auth.isInternal;
  readonly isManager = this.auth.isManager;

  readonly brandRoute = computed(() =>
    this.isInternal() ? this.auth.getManagementRoute() : '/home',
  );

  /** Whether the account menu is open. */
  readonly menuOpen = signal(false);

  /** The shop destinations that stay visible in the bar. */
  readonly menu: MenuItem[] = [
    { path: '/home', key: 'NAV.HOME' },
    { path: '/journals', key: 'NAV.JOURNALS' },
    { path: '/shop', key: 'NAV.SHOP' },
    { path: '/studio', key: 'NAV.STUDIO' },
    { path: '/community', key: 'NAV.COMMUNITY' },
  ];

  /** Personal destinations, kept behind the account button so the bar stays on one line. */
  readonly accountMenu: MenuItem[] = [
    { path: '/orders', key: 'NAV.ORDER' },
    { path: '/designs', key: 'NAV.DESIGNS' },
    { path: '/pets', key: 'NAV.PET' },
    { path: '/restore', key: 'NAV.RESTORE' },
    { path: '/colors', key: 'NAV.PALETTE' },
  ];

  /** The footer lists everything, since it has the room. */
  readonly footerMenu: MenuItem[] = [...this.menu, { path: '/diaries', key: 'NAV.PUBLIC_DIARIES' }, ...this.accountMenu];

  /** Shown to internal staff only. The server re-checks permission on every request. */
  /** Cac man hinh van hanh, chi mo cho nhom Quan ly. */
  readonly managerMenu: MenuItem[] = [
    { path: '/admin/orders', key: 'NAV.DISPATCH_ORDER' },
    { path: '/admin/customers', key: 'NAV.CUSTOMER' },
    { path: '/admin/settings', key: 'NAV.SETTINGS' },
    { path: '/admin/accounts', key: 'NAV.ACCOUNTS' },
  ];

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeMenuOnEscape(): void {
    if (this.menuOpen()) {
      this.closeMenu();
    }
  }

  @HostListener('document:click', ['$event'])
  closeMenuOnOutsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.menuOpen() && !target?.closest('.account-menu, .account-button')) {
      this.closeMenu();
    }
  }

  logout(): void {
    this.closeMenu();
    this.cart.reset();
    this.auth.logout();
  }
}
