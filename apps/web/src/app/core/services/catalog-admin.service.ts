import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import { Accessory, DisplayBase, PackagingOption, ProductType } from '../models/api.model';

/** Cac o gui len khi tao hoac sua mot muc danh muc; tien gui dang chuoi so nguyen dong. */
export type CatalogBody = Record<string, string | number | boolean>;

/** Ba loai muc danh muc don, cung mot kieu doc, tao va sua. */
export type CatalogKind = 'display-bases' | 'accessories' | 'packaging';

export type CatalogItem = DisplayBase | Accessory | PackagingOption;

/**
 * Quan tri danh muc san pham va vat lieu (muc 12, 13). Doc thang tu may chu,
 * khong dung ban luu tam cua trang khach, de thay ngay muc vua sua.
 */
@Injectable({ providedIn: 'root' })
export class CatalogAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  products(): Observable<ProductType[]> {
    return this.http.get<ProductType[]>(`${this.base}/catalog/products`);
  }

  createProduct(body: CatalogBody): Observable<ProductType> {
    return this.http.post<ProductType>(`${this.base}/catalog/products`, body);
  }

  updateProduct(code: string, body: CatalogBody): Observable<ProductType> {
    return this.http.patch<ProductType>(`${this.base}/catalog/products/${code}`, body);
  }

  addSize(code: string, body: CatalogBody): Observable<ProductType> {
    return this.http.post<ProductType>(`${this.base}/catalog/products/${code}/sizes`, body);
  }

  updateSize(code: string, size: string, body: CatalogBody): Observable<ProductType> {
    return this.http.patch<ProductType>(`${this.base}/catalog/products/${code}/sizes/${size}`, body);
  }

  items(kind: CatalogKind): Observable<CatalogItem[]> {
    return this.http.get<CatalogItem[]>(`${this.base}/catalog/${kind}`);
  }

  createItem(kind: CatalogKind, body: CatalogBody): Observable<CatalogItem> {
    return this.http.post<CatalogItem>(`${this.base}/catalog/${kind}`, body);
  }

  updateItem(kind: CatalogKind, code: string, body: CatalogBody): Observable<CatalogItem> {
    return this.http.patch<CatalogItem>(`${this.base}/catalog/${kind}/${code}`, body);
  }
}
