import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_BASE } from './api-base';
import { TokenStore } from './token-store';
import { LoginResult, Role } from '../models/api.model';

const INTERNAL: Role[] = ['MANAGER', 'ADMIN', 'SUPPORT'];

/** The two groups allowed to move an order status by hand. */
const OPERATIONS: Role[] = ['MANAGER', 'ADMIN'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);
  private readonly store = inject(TokenStore);
  private readonly router = inject(Router);

  readonly user = this.store.user.asReadonly();
  readonly isSignedIn = computed(() => this.user() !== null);
  readonly isInternal = computed(() =>
    (this.user()?.roles ?? []).some((role) => INTERNAL.includes(role)),
  );

  /**
   * Only used to show or hide buttons. The server re-checks permission on every
   * request and does not rely on this signal.
   */
  readonly isOperations = computed(() =>
    (this.user()?.roles ?? []).some((role) => OPERATIONS.includes(role)),
  );

  /** Only the Manager group may change business settings. */
  readonly isManager = computed(() => (this.user()?.roles ?? []).includes('MANAGER'));

  login(email: string, password: string): Observable<LoginResult> {
    return this.http
      .post<LoginResult>(`${this.base}/auth/login`, { email, password })
      .pipe(tap((result) => this.store.save(result.accessToken, result.refreshToken, result.user)));
  }

  register(email: string, password: string, fullName: string): Observable<LoginResult> {
    return this.http
      .post<LoginResult>(`${this.base}/auth/register`, { email, password, fullName })
      .pipe(tap((result) => this.store.save(result.accessToken, result.refreshToken, result.user)));
  }

  logout(): void {
    this.store.remove();
    void this.router.navigate(['/login']);
  }
}
