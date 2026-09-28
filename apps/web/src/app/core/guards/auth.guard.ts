import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

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

export const customerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isSignedIn() ? router.createUrlTree(['/home']) : true;
};

/** Only internal staff may reach the operations screens. */
export const internalGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isSignedIn()) {
    return router.createUrlTree(['/login']);
  }
  return auth.isInternal() ? true : router.createUrlTree(['/home']);
};

/** The business settings page is open to the two operations groups only. */
export const operationsGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isSignedIn()) {
    return router.createUrlTree(['/login']);
  }
  return auth.isOperations() ? true : router.createUrlTree(['/home']);
};
