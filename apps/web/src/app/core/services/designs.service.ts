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

  hide(id: string): Observable<Design> {
    return this.http.delete<Design>(`${this.base}/designs/${id}`);
  }

  /** The price is always asked of the server, never computed in the browser. */
  quote(productTypeCode: string, sizeCode: string): Observable<Quote> {
    return this.http.get<Quote>(`${this.base}/designs/quote`, {
      params: new HttpParams().set('productTypeCode', productTypeCode).set('sizeCode', sizeCode),
    });
  }

  loadPreview(id: string, angle: PreviewAngle, photo: Blob): Observable<Design> {
    const form = new FormData();
    form.append('angle', angle);
    form.append('file', photo, `${angle}.png`);
    return this.http.post<Design>(`${this.base}/designs/${id}/preview`, form);
  }
}
