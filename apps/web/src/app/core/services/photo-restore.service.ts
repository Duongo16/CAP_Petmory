import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from './api-base';

/** Ban da phuc hoi cua mot tam anh, kem do giong voi anh goc. */
export interface RestoredPicture {
  picture: Blob;
  /** Tu 0 toi 100; null khi may chu khong gui kem. */
  resemblance: number | null;
  /** LIVE khi co thao tac AI chay that, LOCAL khi chi dung bo loc tai may. */
  mode: 'LIVE' | 'LOCAL';
  /** Thao tac AI da chon nhung khong lam duoc. */
  skipped: string[];
}

/** So luot phuc hoi con lai: han muc moi ngay va so luot con dung duoc, am la khong gioi han. */
export interface RestoreQuota {
  day: number;
  left: number;
}

/** Cac thao tac phuc hoi khach chon duoc; hai thao tac cuoi dung mo hinh sua anh. */
export type RestoreOperation = 'UPSCALE' | 'SHARPEN' | 'DENOISE' | 'EXPOSURE' | 'CONTRAST' | 'FACE_DETAIL' | 'REMOVE_BACKGROUND';

/**
 * Phuc hoi mot tam anh rieng le. Khong dinh toi ho so hay album thu cung nao:
 * anh gui di, ban phuc hoi tra ve, may chu khong giu lai gi.
 */
@Injectable({ providedIn: 'root' })
export class PhotoRestoreService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  quota(): Observable<RestoreQuota> {
    return this.http.get<RestoreQuota>(`${this.base}/photo-restore/quota`);
  }

  restore(file: File, operations: RestoreOperation[] = []): Observable<RestoredPicture> {
    const form = new FormData();
    form.append('file', file, file.name);
    for (const one of operations) {
      form.append('operation', one);
    }
    return this.http
      .post(`${this.base}/photo-restore`, form, { observe: 'response', responseType: 'blob' })
      .pipe(
        map((answer) => {
          const score = Number.parseFloat(answer.headers.get('X-Resemblance') ?? '');
          const skipped = (answer.headers.get('X-Restore-Skipped') ?? '').split(',').filter(Boolean);
          return {
            picture: answer.body ?? new Blob(),
            resemblance: Number.isFinite(score) ? Math.round(score) : null,
            mode: answer.headers.get('X-Restore-Mode') === 'LIVE' ? 'LIVE' : 'LOCAL',
            skipped,
          };
        }),
      );
  }
}
