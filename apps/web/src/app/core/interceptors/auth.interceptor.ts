import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenStore } from '../services/token-store';

/** Marks the only retry allowed for a request after an access-token refresh. */
const RETRIED_AFTER_REFRESH = new HttpContextToken<boolean>(() => false);

/** Only these endpoints deliberately work without an authenticated session. */
const PUBLIC_AUTH_ENDPOINT = /\/auth\/(?:login|register|refresh|forgot-password|reset-password|demo-accounts)(?:[/?#]|$)/i;

let refreshInFlight$: Observable<string> | null = null;

/**
 * Attaches the access token in one place. When it has expired, concurrent API
 * calls wait for one shared refresh, then each retries exactly once.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(TokenStore);
  const injector = inject(Injector);
  const isPublicAuthRequest = PUBLIC_AUTH_ENDPOINT.test(req.url);
  const token = isPublicAuthRequest ? null : store.getAccessToken();
  const sessionUserId = token ? store.user()?.id ?? null : null;

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        error.status !== 401 ||
        !token ||
        isPublicAuthRequest ||
        req.context.get(RETRIED_AFTER_REFRESH) ||
        store.user()?.id !== sessionUserId
      ) {
        return throwError(() => error);
      }

      return refreshAccessToken(injector, store).pipe(
        catchError((refreshError: HttpErrorResponse) => {
          store.remove();
          void injector.get(Router).navigate(['/login']);
          return throwError(() => refreshError);
        }),
        switchMap((freshToken) =>
          next(
            req.clone({
              context: req.context.set(RETRIED_AFTER_REFRESH, true),
              setHeaders: { Authorization: `Bearer ${freshToken}` },
            }),
          ),
        ),
      );
    }),
  );
};

function refreshAccessToken(injector: Injector, store: TokenStore): Observable<string> {
  if (refreshInFlight$) {
    return refreshInFlight$;
  }

  refreshInFlight$ = injector
    .get(AuthService)
    .refresh()
    .pipe(
      map((result) => result.accessToken),
      finalize(() => {
        refreshInFlight$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  return refreshInFlight$;
}
