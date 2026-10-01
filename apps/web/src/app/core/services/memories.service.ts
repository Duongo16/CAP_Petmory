import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import {
  DecorItem,
  DiaryBook,
  DiaryExport,
  DiaryList,
  DiaryPage,
  DiaryShare,
  Memory,
  MemoryTopic,
  MusicTrack,
  Pet,
} from '../models/api.model';

export interface WriteMemoryInput {
  pet: string;
  title: string;
  body?: string;
  happenedAt: string;
  place?: string;
  topic?: MemoryTopic;
  tag?: string[];
  photo?: string[];
  decor?: DecorItem[];
  paper?: string;
  isMilestone?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MemoriesService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  /** One page of a pet's diary, newest moment first. */
  forPet(petId: string, page = 1, topic?: MemoryTopic): Observable<DiaryPage> {
    let params = new HttpParams().set('page', page);
    if (topic) {
      params = params.set('topic', topic);
    }
    return this.http.get<DiaryPage>(`${this.base}/memories/pet/${petId}`, { params });
  }

  /** The newest moments across every pet, for the daily summary. */
  recent(): Observable<Memory[]> {
    return this.http.get<Memory[]>(`${this.base}/memories/recent`);
  }

  /** A moment from an earlier year that falls near today, if there is one. */
  onThisDay(): Observable<Memory | null> {
    return this.http.get<Memory | null>(`${this.base}/memories/on-this-day`);
  }

  write(input: WriteMemoryInput): Observable<Memory> {
    return this.http.post<Memory>(`${this.base}/memories`, input);
  }

  change(id: string, input: Partial<WriteMemoryInput>): Observable<Memory> {
    return this.http.patch<Memory>(`${this.base}/memories/${id}`, input);
  }

  hide(id: string): Observable<Memory> {
    return this.http.delete<Memory>(`${this.base}/memories/${id}`);
  }

  /** Bat hoac tat che do cong khai cho ca quyen nhat ky cua mot be. */
  setPrivacy(petId: string, isPublic: boolean): Observable<Pet> {
    return this.http.patch<Pet>(`${this.base}/memories/pet/${petId}/privacy`, { isPublic });
  }

  /**
   * Tao mot duong dan chia se.
   *
   * Ma tra ve chi xuat hien dung lan nay, vi may chu khong giu ban nguyen van.
   * Man hinh phai hien ngay de nguoi dung sao lai.
   */
  makeShare(petId: string, expiresAt?: string): Observable<{ share: DiaryShare; code: string }> {
    return this.http.post<{ share: DiaryShare; code: string }>(
      `${this.base}/memories/pet/${petId}/shares`,
      expiresAt ? { expiresAt } : {},
    );
  }

  listShares(petId: string): Observable<DiaryShare[]> {
    return this.http.get<DiaryShare[]>(`${this.base}/memories/pet/${petId}/shares`);
  }

  revokeShare(id: string): Observable<DiaryShare> {
    return this.http.delete<DiaryShare>(`${this.base}/memories/shares/${id}`);
  }

  askExport(petId: string, fromDate?: string, toDate?: string): Observable<DiaryExport> {
    const body: Record<string, string> = {};
    if (fromDate) {
      body['fromDate'] = fromDate;
    }
    if (toDate) {
      body['toDate'] = toDate;
    }
    return this.http.post<DiaryExport>(`${this.base}/memories/pet/${petId}/exports`, body);
  }

  exportState(id: string): Observable<DiaryExport> {
    return this.http.get<DiaryExport>(`${this.base}/memories/exports/${id}`);
  }

  exportFile(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/memories/exports/${id}/file`, {
      responseType: 'blob',
    });
  }

  /** Danh sach cac quyen dang de cong khai, doc duoc khi chua dang nhap. */
  publicDiaries(page = 1, topic?: MemoryTopic, keyword?: string): Observable<DiaryList> {
    let params = new HttpParams().set('page', page);
    if (topic) {
      params = params.set('topic', topic);
    }
    if (keyword) {
      params = params.set('keyword', keyword);
    }
    return this.http.get<DiaryList>(`${this.base}/diaries`, { params });
  }

  publicDiary(petId: string): Observable<DiaryBook> {
    return this.http.get<DiaryBook>(`${this.base}/diaries/${petId}`);
  }

  diaryByShare(code: string): Observable<DiaryBook> {
    return this.http.get<DiaryBook>(`${this.base}/diaries/share/${code}`);
  }

  /** Kho nhac dung cho trinh chieu. Rong khi Ben A chua cung cap ban nao. */
  music(): Observable<MusicTrack[]> {
    return this.http.get<MusicTrack[]>(`${this.base}/diaries/music`);
  }

  /** Luu cach trinh chieu cua mot quyen: bai nhac, hieu ung, thoi luong. */
  setSlide(
    petId: string,
    wanted: { trackCode?: string; effect?: string; seconds?: number },
  ): Observable<Pet> {
    return this.http.patch<Pet>(`${this.base}/memories/pet/${petId}/slideshow`, wanted);
  }

  /** Dia chi xem duoc cua mot buc anh trong quyen dang de cong khai. */
  publicPhotoLink(photoId: string): string {
    return `${this.base}/diaries/photo/${photoId}`;
  }
}
