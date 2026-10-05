import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import { Goods, GoodsCategory, GoodsPage, StockMove } from '../models/api.model';

/** Bo loc cua trang danh muc hang co san. */
export interface GoodsFilter {
  page?: number;
  category?: string;
  keyword?: string;
  sort?: string;
}

/** Mot to hop khi tao hoac sua mon hang tu trang quan tri. */
export interface GoodsVariantInput {
  sku: string;
  optionValues: string[];
  price: string;
  stock?: number;
  enabled?: boolean;
}

/** Mot mon hang khi tao hoac sua tu trang quan tri. */
export interface GoodsInput {
  code?: string;
  name?: string;
  category?: string;
  description?: string;
  images?: string[];
  optionNames?: string[];
  variant?: GoodsVariantInput[];
  deliveryDays?: number;
  enabled?: boolean;
}

/** Mot nhom hang khi tao hoac sua tu trang quan tri. */
export interface GoodsCategoryInput {
  code?: string;
  name?: string;
  description?: string;
  sortOrder?: number;
  enabled?: boolean;
}

@Injectable({ providedIn: 'root' })
export class GoodsService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  /** Cac nhom hang dang bat. Doc duoc khi chua dang nhap. */
  categories(): Observable<GoodsCategory[]> {
    return this.http.get<GoodsCategory[]>(`${this.base}/goods/categories`);
  }

  list(filter: GoodsFilter = {}): Observable<GoodsPage> {
    let params = new HttpParams().set('page', filter.page ?? 1);
    if (filter.category) {
      params = params.set('category', filter.category);
    }
    if (filter.keyword) {
      params = params.set('keyword', filter.keyword);
    }
    if (filter.sort) {
      params = params.set('sort', filter.sort);
    }
    return this.http.get<GoodsPage>(`${this.base}/goods`, { params });
  }

  detail(code: string): Observable<Goods> {
    return this.http.get<Goods>(`${this.base}/goods/${code}`);
  }

  // --- Duong cua trang quan tri ---

  adminCategories(): Observable<GoodsCategory[]> {
    return this.http.get<GoodsCategory[]>(`${this.base}/admin/goods/categories`);
  }

  adminList(filter: GoodsFilter = {}): Observable<GoodsPage> {
    let params = new HttpParams().set('page', filter.page ?? 1);
    if (filter.category) {
      params = params.set('category', filter.category);
    }
    if (filter.keyword) {
      params = params.set('keyword', filter.keyword);
    }
    return this.http.get<GoodsPage>(`${this.base}/admin/goods`, { params });
  }

  adminDetail(code: string): Observable<Goods> {
    return this.http.get<Goods>(`${this.base}/admin/goods/${code}`);
  }

  create(input: GoodsInput): Observable<Goods> {
    return this.http.post<Goods>(`${this.base}/admin/goods`, input);
  }

  update(code: string, input: GoodsInput): Observable<Goods> {
    return this.http.patch<Goods>(`${this.base}/admin/goods/${code}`, input);
  }

  hide(code: string): Observable<Goods> {
    return this.http.delete<Goods>(`${this.base}/admin/goods/${code}`);
  }

  /** Nhap hoac dieu chinh ton kho. Ly do la bat buoc. */
  adjustStock(code: string, sku: string, delta: number, note: string): Observable<Goods> {
    return this.http.patch<Goods>(`${this.base}/admin/goods/${code}/stock/${sku}`, {
      delta,
      note,
    });
  }

  createCategory(input: GoodsCategoryInput): Observable<GoodsCategory> {
    return this.http.post<GoodsCategory>(`${this.base}/admin/goods/categories`, input);
  }

  updateCategory(code: string, input: GoodsCategoryInput): Observable<GoodsCategory> {
    return this.http.patch<GoodsCategory>(`${this.base}/admin/goods/categories/${code}`, input);
  }

  hideCategory(code: string): Observable<GoodsCategory> {
    return this.http.delete<GoodsCategory>(`${this.base}/admin/goods/categories/${code}`);
  }

  stockMoves(code: string, sku: string): Observable<StockMove[]> {
    return this.http.get<StockMove[]>(`${this.base}/admin/goods/${code}/stock/${sku}`);
  }
}
