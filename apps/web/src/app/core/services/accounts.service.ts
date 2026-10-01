import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import { Account, AccountPage, Role } from '../models/api.model';

/**
 * Quan ly tai khoan, danh cho nhom Quan tri vien.
 *
 * Nhom nay khong cham vao don hang hay tien, nen dich vu nay khong co duong
 * nao doc du lieu kinh doanh.
 */
@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  list(keyword: string, role: string, page: number): Observable<AccountPage> {
    let params = new HttpParams().set('page', page);
    if (keyword.trim() !== '') {
      params = params.set('keyword', keyword.trim());
    }
    if (role !== '') {
      params = params.set('role', role);
    }
    return this.http.get<AccountPage>(`${this.base}/admin/accounts`, { params });
  }

  /** So tai khoan theo tung nhom quyen. */
  summary(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.base}/admin/accounts/summary`);
  }

  create(input: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    role: Role;
  }): Observable<Account> {
    return this.http.post<Account>(`${this.base}/admin/accounts`, input);
  }

  changeRole(id: string, role: Role): Observable<Account> {
    return this.http.patch<Account>(`${this.base}/admin/accounts/${id}/role`, { role });
  }

  setActive(id: string, active: boolean): Observable<Account> {
    return this.http.patch<Account>(`${this.base}/admin/accounts/${id}/active`, { active });
  }

  resetPassword(id: string, password: string): Observable<{ done: boolean }> {
    return this.http.patch<{ done: boolean }>(
      `${this.base}/admin/accounts/${id}/password`,
      { password },
    );
  }
}
