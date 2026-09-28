import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import {
  BusinessConfig,
  AdminOrderDetail,
  Order,
  CustomerRow,
  CustomerProfile,
  ProductionFile,
  OrderFilter,
  UpdateBusinessConfig,
  TransferNotification,
  PageResult,
  OrderStatus,
} from '../models/api.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  statsOrder(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.base}/admin/orders/stats`);
  }

  listOrder(filter: OrderFilter): Observable<PageResult<Order>> {
    let ts = new HttpParams();
    if (filter.status) {
      ts = ts.set('status', filter.status);
    }
    if (filter.keyword) {
      ts = ts.set('keyword', filter.keyword);
    }
    if (filter.page && filter.page > 1) {
      ts = ts.set('page', filter.page);
    }
    return this.http.get<PageResult<Order>>(`${this.base}/admin/orders`, { params: ts });
  }

  detailOrder(orderCode: string): Observable<AdminOrderDetail> {
    return this.http.get<AdminOrderDetail>(`${this.base}/admin/orders/${orderCode}`);
  }

  changeStatus(
    orderCode: string,
    status: OrderStatus,
    reason: string,
  ): Observable<AdminOrderDetail> {
    return this.http.patch<AdminOrderDetail>(
      `${this.base}/admin/orders/${orderCode}/status`,
      { status, reason },
    );
  }

  listCustomers(keyword: string, page: number): Observable<PageResult<CustomerRow>> {
    let ts = new HttpParams();
    if (keyword) {
      ts = ts.set('keyword', keyword);
    }
    if (page > 1) {
      ts = ts.set('page', page);
    }
    return this.http.get<PageResult<CustomerRow>>(`${this.base}/admin/customers`, {
      params: ts,
    });
  }

  customerProfile(id: string): Observable<CustomerProfile> {
    return this.http.get<CustomerProfile>(`${this.base}/admin/customers/${id}`);
  }

  productionFile(orderCode: string): Observable<ProductionFile> {
    return this.http.get<ProductionFile>(
      `${this.base}/admin/orders/${orderCode}/production-file`,
    );
  }

  /** URL of a design preview, used by the image tiles in the production file. */
  pathPhotoDesign(designId: string, angle: string): string {
    return `${this.base}/admin/designs/${designId}/preview/${angle}`;
  }

  getConfig(): Observable<BusinessConfig> {
    return this.http.get<BusinessConfig>(`${this.base}/settings`);
  }

  updateConfig(replaceChange: UpdateBusinessConfig): Observable<BusinessConfig> {
    return this.http.patch<BusinessConfig>(`${this.base}/settings`, replaceChange);
  }

  logPayment(limit = 100): Observable<TransferNotification[]> {
    return this.http.get<TransferNotification[]>(`${this.base}/payments/log`, {
      params: new HttpParams().set('limit', limit),
    });
  }
}
