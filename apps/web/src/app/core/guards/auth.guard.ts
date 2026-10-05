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
 * Chan nguoi noi bo khoi cac trang danh cho khach hang.
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

/** Quan ly va Cham soc khach hang: don, khach hang, hoi thoai, nhat ky thanh toan. */
export const deskGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isSignedIn()) {
    return router.createUrlTree(['/login']);
  }
  return auth.isDesk() ? true : router.createUrlTree([auth.getDefaultRoute()]);
};

/** Kiem duyet cong dong: nhom Quan ly, da gop ca phan viec cua Quan tri vien. */
export const moderatorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isSignedIn()) {
    return router.createUrlTree(['/login']);
  }
  return auth.isManager() ? true : router.createUrlTree([auth.getDefaultRoute()]);
};

