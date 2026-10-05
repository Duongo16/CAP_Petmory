import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { API_BASE } from './api-base';
import {
  Accessory,
  ColorCode,
  ColorGroup,
  DisplayBase,
  PackagingOption,
  PendingReview,
  ProductReview,
  ProductType,
} from '../models/api.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  /** The catalog changes rarely within a session, so the result is shared. */
  readonly color$ = this.http
    .get<ColorCode[]>(`${this.base}/catalog/colors`)
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  readonly product$ = this.http
    .get<ProductType[]>(`${this.base}/catalog/products`)
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  /** The stands offered on the product page, shared for the same reason. */
  readonly displayBase$ = this.http
    .get<DisplayBase[]>(`${this.base}/catalog/display-bases`)
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  /** Phu kien dung chung, doc mot lan roi dung lai. */
  readonly accessory$ = this.http
    .get<Accessory[]>(`${this.base}/catalog/accessories`)
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  /** Hop va khung dang ban, kem gia do Quan ly dat. */
  readonly packaging$ = this.http
    .get<PackagingOption[]>(`${this.base}/catalog/packaging`)
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  productDetail(code: string): Observable<ProductType> {
    return this.http.get<ProductType>(`${this.base}/catalog/products/${code}`);
  }

  /** Searching bypasses the shared stream, since each keyword is a fresh answer. */
  searchProduct(keyword: string): Observable<ProductType[]> {
    const params = keyword.trim() ? new HttpParams().set('keyword', keyword.trim()) : undefined;
    return this.http.get<ProductType[]>(`${this.base}/catalog/products`, { params });
  }

  /** The whole palette including disabled colours. Internal staff only. */
  allColors(): Observable<ColorCode[]> {
    return this.http.get<ColorCode[]>(`${this.base}/catalog/colors`);
  }

  createColor(input: {
    code: string;
    displayName: string;
    swatch: string;
    group: ColorGroup;
    note?: string;
  }): Observable<ColorCode> {
    return this.http.post<ColorCode>(`${this.base}/catalog/colors`, input);
  }

  updateColor(code: string, change: Partial<ColorCode>): Observable<ColorCode> {
    return this.http.patch<ColorCode>(`${this.base}/catalog/colors/${code}/edit`, change);
  }

  toggleColorEnabled(code: string, enabled: boolean): Observable<ColorCode> {
    return this.http.patch<ColorCode>(`${this.base}/catalog/colors/${code}`, { enabled });
  }

  reviewsOf(code: string): Observable<ProductReview[]> {
    return this.http.get<ProductReview[]>(`${this.base}/reviews/product/${code}`);
  }

  pendingReviews(): Observable<PendingReview[]> {
    return this.http.get<PendingReview[]>(`${this.base}/reviews/pending`);
  }

  writeReview(input: {
    productTypeCode: string;
    orderCode: string;
    rating: number;
    comment?: string;
  }): Observable<unknown> {
    return this.http.post(`${this.base}/reviews`, input);
  }

  favouriteCodes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/favourites/codes`);
  }

  toggleFavourite(code: string): Observable<{ favourite: boolean }> {
    return this.http.post<{ favourite: boolean }>(`${this.base}/favourites/${code}/toggle`, {});
  }
}
