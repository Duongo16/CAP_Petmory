import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import { Quote, PreviewAngle, SaveDesign, Design } from '../models/api.model';

/** The six preview angles, in the order shown on screen. */
export const ANGLES_PREVIEW: PreviewAngle[] = [
  'FRONT',
  'LEFT',
  'RIGHT',
  'BACK',
  'TOP',
  'ISO',
];

@Injectable({ providedIn: 'root' })
export class DesignsService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  list(): Observable<Design[]> {
    return this.http.get<Design[]>(`${this.base}/designs`);
  }

  detail(id: string): Observable<Design> {
    return this.http.get<Design>(`${this.base}/designs/${id}`);
  }

  create(than: SaveDesign): Observable<Design> {
    return this.http.post<Design>(`${this.base}/designs`, than);
  }

  update(id: string, than: SaveDesign): Observable<Design> {
    return this.http.patch<Design>(`${this.base}/designs/${id}`, than);
  }

  /** Chi doi ten, khong gui lai mau da to. */
  rename(id: string, name: string): Observable<Design> {
    return this.http.patch<Design>(`${this.base}/designs/${id}/name`, { name });
  }

  /**
   * Anh xem truoc cua mot goc, doc bang tai khoan dang nhap nen phai tai qua
   * HttpClient. Phien ban la moc sua gan nhat, de luu lai la co anh moi.
   */
  previewBlob(id: string, angle: string, version = ''): Observable<Blob> {
    return this.http.get(`${this.base}/designs/${id}/preview/${angle}`, {
      params: version ? new HttpParams().set('v', version) : undefined,
      responseType: 'blob',
    });
  }

  hide(id: string): Observable<Design> {
    return this.http.delete<Design>(`${this.base}/designs/${id}`);
  }

  /** The price is always asked of the server, never computed in the browser. */
  /** Bao gia tu may chu, gom ca de va phu kien neu da chon. */
  quote(productTypeCode: string, sizeCode: string, baseCode = '', accessories: string[] = []): Observable<Quote> {
    let params = new HttpParams().set('productTypeCode', productTypeCode).set('sizeCode', sizeCode);
    if (baseCode) {
      params = params.set('baseCode', baseCode);
    }
    if (accessories.length > 0) {
      params = params.set('accessories', accessories.join(','));
    }
    return this.http.get<Quote>(`${this.base}/designs/quote`, { params });
  }

  loadPreview(id: string, angle: PreviewAngle, photo: Blob): Observable<Design> {
    const form = new FormData();
    form.append('angle', angle);
    form.append('file', photo, `${angle}.png`);
    return this.http.post<Design>(`${this.base}/designs/${id}/preview`, form);
  }
}
