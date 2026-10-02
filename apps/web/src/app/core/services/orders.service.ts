import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import { Order, PaymentQr } from '../models/api.model';

export interface CreateOrderInput {
  fullName: string;
  phone: string;
  address: string;
  province: string;
  note?: string;
}

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  list(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.base}/orders`);
  }

  detail(orderCode: string): Observable<Order> {
    return this.http.get<Order>(`${this.base}/orders/${orderCode}`);
  }

  create(input: CreateOrderInput): Observable<Order> {
    return this.http.post<Order>(`${this.base}/orders`, input);
  }

  /** Khach tu huy mot don con dang cho thanh toan. */
  cancel(orderCode: string): Observable<Order> {
    return this.http.post<Order>(`${this.base}/orders/${orderCode}/cancel`, {});
  }

  maQr(orderCode: string): Observable<PaymentQr> {
    return this.http.get<PaymentQr>(`${this.base}/payments/qr/${orderCode}`);
  }
}
