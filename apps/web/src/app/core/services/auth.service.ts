import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_BASE } from './api-base';
import { TokenStore } from './token-store';
import { DemoAccount, LoginResult, Role } from '../models/api.model';

/** Cac nhom duoc tinh la nguoi cua PETMORY. */
const INTERNAL: Role[] = ['MANAGER', 'ADMIN', 'SUPPORT'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);
  private readonly store = inject(TokenStore);
  private readonly injector = inject(Injector);

  readonly user = this.store.user.asReadonly();
  readonly isSignedIn = computed(() => this.user() !== null);
  readonly isInternal = computed(() =>
    (this.user()?.roles ?? []).some((role) => INTERNAL.includes(role)),
  );

  /**
   * Nhom Quan ly: san pham, don hang, vat lieu, tham so, bao cao, kho hang.
   *
   * Chi dung de an hien nut. May chu kiem lai quyen o moi yeu cau va khong
   * dua vao dau hieu nay.
   */
  readonly isManager = computed(() => (this.user()?.roles ?? []).includes('MANAGER'));

  /** Nhom Quan tri vien: chi quan ly tai khoan. */
  readonly isAccountAdmin = computed(() => (this.user()?.roles ?? []).includes('ADMIN'));

  /** Duoc vao ban dieu phoi: xem don, khach hang, truc hoi thoai. Quan ly va Cham soc khach hang. */
  readonly isDesk = computed(() => {
    const roles = this.user()?.roles ?? [];
    return roles.includes('MANAGER') || roles.includes('SUPPORT');
  });

  /** Khach hang thong thuong. */
  readonly isCustomer = computed(() => !this.isInternal());

  /** Trang quan ly tuong ung theo role cua tai khoan noi bo. */
  getManagementRoute(): string {
    if (this.isDesk()) {
      return '/admin/orders';
    }
    if (this.isAccountAdmin()) {
      return '/admin/accounts';
    }
    return '/home';
  }

  /** Trang mac dinh sau dang nhap hoac khi vao ung dung theo role. */
  getDefaultRoute(): string {
    if (this.isInternal()) {
      return this.getManagementRoute();
    }
    return '/home';
  }

  /**
   * Cac tai khoan mau de dang nhap nhanh khi dang lam o may ca nhan.
   *
   * May chu that tra ve danh sach rong, nen man hinh dang nhap khong hien
   * nut nao. Khong co mat khau nao duoc viet cung trong ma nguon o day.
   */
  demoAccounts(): Observable<DemoAccount[]> {
    return this.http.get<DemoAccount[]>(`${this.base}/auth/demo-accounts`);
  }

  login(email: string, password: string): Observable<LoginResult> {
    return this.http
      .post<LoginResult>(`${this.base}/auth/login`, { email, password })
      .pipe(tap((result) => this.store.save(result.accessToken, result.refreshToken, result.user)));
  }

  register(
    email: string,
    password: string,
    fullName: string,
    phone?: string,
  ): Observable<LoginResult> {
    return this.http
      .post<LoginResult>(`${this.base}/auth/register`, {
        email,
        password,
        fullName,
        ...(phone ? { phone } : {}),
      })
      .pipe(tap((result) => this.store.save(result.accessToken, result.refreshToken, result.user)));
  }

  logout(): void {
    this.store.remove();
    void this.injector.get(Router).navigate(['/login']);
  }
}
