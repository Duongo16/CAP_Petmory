import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from './api-base';

/** Ban da phuc hoi cua mot tam anh, kem do giong voi anh goc. */
export interface RestoredPicture {
  picture: Blob;
  /** Tu 0 toi 100; null khi may chu khong gui kem. */
  resemblance: number | null;
}

/**
 * Phuc hoi mot tam anh rieng le. Khong dinh toi ho so hay album thu cung nao:
 * anh gui di, ban phuc hoi tra ve, may chu khong giu lai gi.
 */
@Injectable({ providedIn: 'root' })
export class PhotoRestoreService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  restore(file: File): Observable<RestoredPicture> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http
      .post(`${this.base}/photo-restore`, form, { observe: 'response', responseType: 'blob' })
      .pipe(
        map((answer) => {
          const score = Number.parseFloat(answer.headers.get('X-Resemblance') ?? '');
          return {
            picture: answer.body ?? new Blob(),
            resemblance: Number.isFinite(score) ? Math.round(score) : null,
          };
        }),
      );
  }
}
