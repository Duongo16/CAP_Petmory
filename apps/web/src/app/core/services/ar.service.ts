import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';

/** Nhung gi trang AR biet ve don mo bang QR: mau len va ten be. */
export interface ArView {
  modelCode: string;
  petName: string;
}

@Injectable({ providedIn: 'root' })
export class ArService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  /** Doc be cua mot don tu ma trong QR; khong can dang nhap. */
  view(arCode: string): Observable<ArView> {
    return this.http.get<ArView>(`${this.base}/ar/${encodeURIComponent(arCode)}`);
  }
}
