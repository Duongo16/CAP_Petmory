import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

/** Kiem tra nguoi dung da dang nhap hay chua. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isSignedIn()) {
    return true;
  }
  return router.createUrlTree(['/login'], {
    queryParams: { continue: state.url },
  });
};

/**
 * Trang danh rieng cho khach chua dang nhap (landing, login, register).
 * Neu da dang nhap, chuyen huong ve trang mac dinh theo role.
 */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isSignedIn()) {
    return router.createUrlTree([auth.getDefaultRoute()]);
  }
  return true;
};

/** Giu lai alias de tuong thich ma nguon hien co. */
export const customerGuard: CanActivateFn = guestGuard;

/**
 * Chan cac role khac khach hang (MANAGER, ADMIN) khoi cac trang danh cho khach hang.
 * Hien thong bao khong thich hop va redirect ve dung trang quan ly cua role do.
 */
export const customerOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const notification = inject(NotificationService);

  if (auth.isInternal()) {
    notification.showRoleRestrictedMessage();
    return router.createUrlTree([auth.getManagementRoute()]);
  }
  return true;
};

/** Cac man hinh van hanh chi mo cho nhom nguoi dung noi bo. */
export const internalGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isSignedIn()) {
    return router.createUrlTree(['/login']);
  }
  return auth.isInternal() ? true : router.createUrlTree(['/home']);
};

/** Cac man hinh van hanh chi mo cho nhom Quan ly. */
export const managerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isSignedIn()) {
    return router.createUrlTree(['/login']);
  }
  return auth.isManager() ? true : router.createUrlTree([auth.getDefaultRoute()]);
};

/** Man hinh quan ly tai khoan chi mo cho nhom Quan tri vien. */
export const accountAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isSignedIn()) {
    return router.createUrlTree(['/login']);
  }
  return auth.isAccountAdmin() ? true : router.createUrlTree([auth.getDefaultRoute()]);
};
