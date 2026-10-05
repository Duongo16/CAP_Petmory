import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { Icon } from '../../../shared/icon/icon';

/** One destination in the side rail. */
interface Stop {
  path: string;
  key: string;
  icon: string;
}

/** Phan van hanh hang ngay, thuoc nhom Quan ly. */
const CORE_STOPS: Stop[] = [
  { path: '/admin/orders', key: 'NAV.DISPATCH_ORDER', icon: 'cart' },
  { path: '/admin/customers', key: 'NAV.CUSTOMER', icon: 'user' },
  { path: '/admin/chats', key: 'NAV.CHAT_DESK', icon: 'comment' },
  { path: '/admin/payment-log', key: 'NAV.LOG_PAYMENT', icon: 'tag' },
];

/** Chi nhom Quan ly: hang co san va kho tri thuc cua tro ly. */
const MANAGER_STOPS: Stop[] = [
  { path: '/admin/goods', key: 'NAV.GOODS_STOCK', icon: 'bookmark' },
  { path: '/admin/assistant', key: 'NAV.ASSISTANT_KNOWLEDGE', icon: 'bulb' },
];

/** Phan xuong va tham so, cung thuoc nhom Quan ly. */
const WORKSHOP_STOPS: Stop[] = [
  { path: '/admin/catalog', key: 'NAV.CATALOG', icon: 'gift' },
  { path: '/admin/reports', key: 'NAV.REPORT', icon: 'tag' },
  { path: '/admin/settings', key: 'NAV.SETTINGS', icon: 'bulb' },
];

/** Phan quan ly tai khoan, thuoc nhom Quan ly. */
const ACCOUNT_STOPS: Stop[] = [
  { path: '/admin/accounts', key: 'NAV.ACCOUNTS', icon: 'shield' },
];

/** Kiem duyet cong dong, thuoc nhom Quan ly. */
const MODERATION_STOP: Stop = { path: '/admin/moderation', key: 'NAV.MODERATION', icon: 'eye' };

/** Nhat ky thao tac, thuoc nhom Quan ly. */
const AUDIT_STOP: Stop = { path: '/admin/audit', key: 'NAV.AUDIT', icon: 'book' };

/**
 * The frame every internal screen sits in: a side rail of destinations beside
 * the screen itself. The rail only hides what an account may not open. The
 * server checks permission again on every request.
 */
import { Brand } from '../../../shared/brand/brand';
import { UserFace } from '../../../shared/user-face/user-face';

@Component({
  selector: 'pm-admin-shell',
  standalone: true,
  imports: [UserFace, Brand, RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, Icon],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  private readonly auth = inject(AuthService);

  readonly isManager = this.auth.isManager;

  /*
   * Thanh ben chi hien nhung cho tai khoan mo duoc.
   *
   * Nhom Quan ly thay het, nhom Cham soc khach hang chi thay ban dieu phoi.
   * Day chi la viec an hien: may chu kiem lai quyen o moi yeu cau.
   */
  readonly coreStops = computed(() => [
    ...(this.auth.isDesk() ? CORE_STOPS : []),
    ...(this.isManager() ? MANAGER_STOPS : []),
  ]);
  readonly workshopStops = computed(() => (this.isManager() ? WORKSHOP_STOPS : []));
  readonly accountStops = computed(() => (this.isManager() ? [MODERATION_STOP, AUDIT_STOP, ...ACCOUNT_STOPS] : []));
  readonly who = computed(() => this.auth.user()?.fullName ?? '');
  readonly avatar = computed(() => this.auth.user()?.avatarUrl ?? null);

  logout(): void {
    this.auth.logout();
  }
}
