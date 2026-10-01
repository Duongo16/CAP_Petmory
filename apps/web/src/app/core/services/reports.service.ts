import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import { AiCostReport, ProgressReport, RevenueReport } from '../models/api.model';

/** Khoang thoi gian nguoi xem chon. De trong thi may chu lay ba muoi ngay. */
export interface ReportPeriod {
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  revenue(period: ReportPeriod): Observable<RevenueReport> {
    return this.http.get<RevenueReport>(`${this.base}/admin/reports/revenue`, {
      params: asParams(period),
    });
  }

  aiCost(period: ReportPeriod): Observable<AiCostReport> {
    return this.http.get<AiCostReport>(`${this.base}/admin/reports/ai-cost`, {
      params: asParams(period),
    });
  }

  progress(period: ReportPeriod): Observable<ProgressReport> {
    return this.http.get<ProgressReport>(`${this.base}/admin/reports/progress`, {
      params: asParams(period),
    });
  }

  /**
   * Tai mot bao cao ve dang tep CSV.
   *
   * Tep di qua duong co kiem quyen chu khong phai dia chi cong khai, nen phai
   * nhan ve trinh duyet roi moi dung mot dia chi tam cho nut luu xuong.
   */
  fileOf(which: 'revenue' | 'ai-cost' | 'progress', period: ReportPeriod): Observable<Blob> {
    return this.http.get(`${this.base}/admin/reports/${which}.csv`, {
      params: asParams(period),
      responseType: 'blob',
    });
  }
}

/** Doi khoang thoi gian sang tham so cua dia chi. */
function asParams(period: ReportPeriod): HttpParams {
  let params = new HttpParams();
  if (period.from) {
    params = params.set('from', period.from);
  }
  if (period.to) {
    params = params.set('to', period.to);
  }
  return params;
}
