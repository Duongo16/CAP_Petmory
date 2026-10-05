import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import {
  Design,
  DesignSuggestion,
  PhotoMatch,
  QuotaLeft,
  SuggestStyleChoice,
} from '../models/api.model';

/**
 * Chuc nang dung tri tue nhan tao cua phia khach: goi y thiet ke.
 *
 * Phan hoi thoai nam o dich vu rieng, vi no con phuc vu ca trang truc cua
 * nhom Cham soc khach hang.
 */
@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  // --- Muc 15: goi y thiet ke ---

  suggestStyles(): Observable<{ style: SuggestStyleChoice[] }> {
    return this.http.get<{ style: SuggestStyleChoice[] }>(`${this.base}/design-suggestions/styles`);
  }

  suggestQuota(): Observable<QuotaLeft> {
    return this.http.get<QuotaLeft>(`${this.base}/design-suggestions/quota`);
  }

  suggestList(): Observable<DesignSuggestion[]> {
    return this.http.get<DesignSuggestion[]>(`${this.base}/design-suggestions`);
  }

  suggestOne(code: string): Observable<DesignSuggestion> {
    return this.http.get<DesignSuggestion>(`${this.base}/design-suggestions/${code}`);
  }

  askSuggestion(petId: string, style: string): Observable<DesignSuggestion> {
    return this.http.post<DesignSuggestion>(`${this.base}/design-suggestions`, { petId, style });
  }

  /** Dung san mot mau gan giong be nhat tu anh cua be. */
  matchFromPhoto(petId: string): Observable<PhotoMatch> {
    return this.http.post<PhotoMatch>(`${this.base}/design-suggestions/from-photo`, { petId });
  }

  /** Chon mot phuong an va nhan ve ban thiet ke de mo sang buoc tuy bien. */
  chooseOption(code: string, optionKey: string): Observable<Design> {
    return this.http.post<Design>(`${this.base}/design-suggestions/${code}/choose`, { optionKey });
  }

  // --- Muc 16: viet cau chuyen ---

}
