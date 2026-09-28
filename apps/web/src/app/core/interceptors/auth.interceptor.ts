import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { TokenStore } from '../services/token-store';

/**
 * Attaches the access token in one place. Individual services never add it by hand.
 * On a session error the session is cleared and the user is sent to the sign-in screen.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(TokenStore);
  const router = inject(Router);
  const token = store.getAccessToken();

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && store.getAccessToken()) {
        store.remove();
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
