import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import {
  AdminOrderDetail,
  AuditEntry,
  BusinessConfig,
  CustomerProfile,
  CustomerRow,
  DiaryModerationPage,
  MusicTrack,
  Order,
  OrderFilter,
  OrderStatus,
  PageResult,
  ProductionFile,
  ReconcileSummary,
  TransferNotification,
  UpdateBusinessConfig,
} from '../models/api.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  statsOrder(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.base}/admin/orders/stats`);
  }

  listOrder(filter: OrderFilter): Observable<PageResult<Order>> {
    let ts = new HttpParams();
    if (filter.status) {
      ts = ts.set('status', filter.status);
    }
    if (filter.keyword) {
      ts = ts.set('keyword', filter.keyword);
    }
    if (filter.page && filter.page > 1) {
      ts = ts.set('page', filter.page);
    }
    return this.http.get<PageResult<Order>>(`${this.base}/admin/orders`, { params: ts });
  }

  detailOrder(orderCode: string): Observable<AdminOrderDetail> {
    return this.http.get<AdminOrderDetail>(`${this.base}/admin/orders/${orderCode}`);
  }

  changeStatus(
    orderCode: string,
    status: OrderStatus,
    reason: string,
  ): Observable<AdminOrderDetail> {
    return this.http.patch<AdminOrderDetail>(
      `${this.base}/admin/orders/${orderCode}/status`,
      { status, reason },
    );
  }

  /** Doc nhat ky thao tac theo bo loc. */
  auditLog(filter: Record<string, string | number>): Observable<PageResult<AuditEntry>> {
    const params = Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== '' && value !== undefined));
    return this.http.get<PageResult<AuditEntry>>(`${this.base}/admin/audit`, { params });
  }

  auditFacets(): Observable<{ resourceType: string[]; action: string[] }> {
    return this.http.get<{ resourceType: string[]; action: string[] }>(`${this.base}/admin/audit/facets`);
  }

  /** Bo co can xu ly tren don, kem ghi chu da xu ly the nao. */
  clearAttention(orderCode: string, note: string): Observable<AdminOrderDetail> {
    return this.http.patch<AdminOrderDetail>(`${this.base}/admin/orders/${orderCode}/attention`, { note });
  }

  /** Tich hoac bo tich mot muc tren phieu kiem tra chat luong. */
  setQualityTick(orderCode: string, at: number, done: boolean): Observable<AdminOrderDetail> {
    return this.http.patch<AdminOrderDetail>(
      `${this.base}/admin/orders/${orderCode}/quality/${at}`,
      { done },
    );
  }

  listCustomers(keyword: string, page: number): Observable<PageResult<CustomerRow>> {
    let ts = new HttpParams();
    if (keyword) {
      ts = ts.set('keyword', keyword);
    }
    if (page > 1) {
      ts = ts.set('page', page);
    }
    return this.http.get<PageResult<CustomerRow>>(`${this.base}/admin/customers`, {
      params: ts,
    });
  }

  customerProfile(id: string): Observable<CustomerProfile> {
    return this.http.get<CustomerProfile>(`${this.base}/admin/customers/${id}`);
  }

  productionFile(orderCode: string): Observable<ProductionFile> {
    return this.http.get<ProductionFile>(
      `${this.base}/admin/orders/${orderCode}/production-file`,
    );
  }

  /** Anh xem truoc cua mot dong don, doc tu ban chup luc dat. */
  pathRowPreview(orderCode: string, rowIndex: number, angle: string): string {
    return `${this.base}/admin/orders/${orderCode}/rows/${rowIndex}/preview/${angle}`;
  }

  /** Duong doc anh tham chieu khach gui cho mot don. */
  pathOrderPhoto(orderCode: string, photoId: string): string {
    return `${this.base}/admin/orders/${orderCode}/photos/${photoId}`;
  }

  /** URL of a design preview, used by the image tiles in the production file. */
  pathPhotoDesign(designId: string, angle: string): string {
    return `${this.base}/admin/designs/${designId}/preview/${angle}`;
  }

  getConfig(): Observable<BusinessConfig> {
    return this.http.get<BusinessConfig>(`${this.base}/settings`);
  }

  /** Luu ca kho nhac trinh chieu, khong dung toi cac tham so khac. */
  updateMusicLibrary(musicLibrary: MusicTrack[]): Observable<BusinessConfig> {
    return this.http.patch<BusinessConfig>(`${this.base}/settings`, { musicLibrary });
  }

  updateConfig(replaceChange: UpdateBusinessConfig): Observable<BusinessConfig> {
    return this.http.patch<BusinessConfig>(`${this.base}/settings`, replaceChange);
  }

  /** Doi soat voi SePay: lay giao dich vai ngay gan nhat va ghi nhan giao dich webhook da bo lo. */
  reconcileSepay(days = 2): Observable<ReconcileSummary> {
    return this.http.post<ReconcileSummary>(`${this.base}/payments/reconcile`, { days });
  }

  logPayment(limit = 100): Observable<TransferNotification[]> {
    return this.http.get<TransferNotification[]>(`${this.base}/payments/log`, {
      params: new HttpParams().set('limit', limit),
    });
  }

  /** Nhat ky cong khai hoac da bi an, cho man kiem duyet cong dong. */
  moderationList(state: 'PUBLIC' | 'BLOCKED', keyword: string, page: number): Observable<DiaryModerationPage> {
    let params = new HttpParams().set('state', state).set('page', page);
    if (keyword.trim()) {
      params = params.set('keyword', keyword.trim());
    }
    return this.http.get<DiaryModerationPage>(`${this.base}/admin/diaries`, { params });
  }

  /** An mot quyen nhat ky khoi cong dong, ly do bat buoc. */
  blockDiary(petId: string, reason: string): Observable<unknown> {
    return this.http.patch(`${this.base}/admin/diaries/${petId}/block`, { reason });
  }

  unblockDiary(petId: string): Observable<unknown> {
    return this.http.patch(`${this.base}/admin/diaries/${petId}/unblock`, {});
  }
}
