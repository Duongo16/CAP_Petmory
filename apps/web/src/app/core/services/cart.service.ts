import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { API_BASE } from './api-base';
import { Cart } from '../models/api.model';

export interface AddToCart {
  productTypeCode: string;
  sizeCode: string;
  quantity: number;
  petName?: string;
  designId?: string;
  /** Optional stand. Left out, the figure is sold without one. */
  displayBaseCode?: string;
}

const EMPTY_CART: Cart = {
  items: [],
  countItem: 0,
  total: '0',
  currency: 'VND',
  productionDaysMax: 0,
};

/**
 * Holds the cart in one place so every screen shows the same count.
 * Values always come from the server; nothing is recomputed in the browser.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  private readonly state = signal<Cart>(EMPTY_CART);

  readonly cart = this.state.asReadonly();
  readonly countItem = computed(() => this.state().countItem);

  reload() {
    return this.http.get<Cart>(`${this.base}/cart`).pipe(tap((g) => this.state.set(g)));
  }

  add(item: AddToCart) {
    return this.http
      .post<Cart>(`${this.base}/cart/items`, item)
      .pipe(tap((g) => this.state.set(g)));
  }

  /**
   * Them mot to hop hang co san vao gio.
   *
   * Duong rieng voi hang tuy bien, vi hai dong hang can hai bo du lieu khac
   * han nhau. Ket qua van la ca gio, nen bo dem tren thanh dieu huong doi
   * theo ngay giong nhu khi them hang tuy bien.
   */
  addGoods(goodsCode: string, sku: string, quantity: number) {
    return this.http
      .post<Cart>(`${this.base}/cart/goods`, { goodsCode, sku, quantity })
      .pipe(tap((g) => this.state.set(g)));
  }

  changeQuantity(id: string, quantity: number) {
    return this.http
      .patch<Cart>(`${this.base}/cart/items/${id}`, { quantity })
      .pipe(tap((g) => this.state.set(g)));
  }

  removeItem(id: string) {
    return this.http
      .delete<Cart>(`${this.base}/cart/items/${id}`)
      .pipe(tap((g) => this.state.set(g)));
  }

  reset(): void {
    this.state.set(EMPTY_CART);
  }
}
