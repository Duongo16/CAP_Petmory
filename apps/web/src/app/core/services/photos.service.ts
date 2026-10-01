import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import {
  PetPhoto,
  PhotoAngle,
  AngleCheckResult,
  PhotoRules,
  RestorationPair,
  RestoreOperation,
} from '../models/api.model';

/** The four required angles, in the order shown on screen. */
export const ANGLE_REQUIRED: PhotoAngle[] = [
  'FRONT',
  'LEFT_SIDE',
  'RIGHT_SIDE',
  'BACK',
];

export const ANGLE_ADD: PhotoAngle[] = ['FACE_CLOSEUP', 'FAVOURITE_POSE'];

@Injectable({ providedIn: 'root' })
export class PhotosService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  /**
   * Cac gioi han ve kich thuoc anh do quan ly dat ra.
   *
   * Trang sua anh can con so nay de canh bao ngay khi nguoi dung keo khung
   * cat qua sau, thay vi de ho gui len roi may chu moi bao la anh qua nho.
   */
  rules(): Observable<PhotoRules> {
    return this.http.get<PhotoRules>(`${this.base}/settings/photo-rules`);
  }

  list(petId: string): Observable<PetPhoto[]> {
    return this.http.get<PetPhoto[]>(`${this.base}/pet-photos`, {
      params: { pet: petId },
    });
  }

  checkAngle(petId: string): Observable<AngleCheckResult> {
    return this.http.get<AngleCheckResult>(`${this.base}/pet-photos/check-angles`, {
      params: { pet: petId },
    });
  }

  load(petId: string, angle: PhotoAngle, file: File): Observable<PetPhoto> {
    const form = new FormData();
    form.append('angle', angle);
    form.append('file', file, file.name);
    return this.http.post<PetPhoto>(`${this.base}/pet-photos/${petId}`, form);
  }

  /**
   * Sends a picture with no angle named.
   *
   * Asking for six named angles was the wrong shape for what people actually do,
   * so a picture now simply belongs to the pet.
   */
  loadGeneral(petId: string, file: File): Observable<PetPhoto> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<PetPhoto>(`${this.base}/pet-photos/${petId}`, form);
  }

  /** Nho may chu tai buc anh o duong dan tren mang ve, thay cho tep tren may. */
  loadByLink(petId: string, url: string): Observable<PetPhoto> {
    return this.http.post<PetPhoto>(`${this.base}/pet-photos/${petId}/from-link`, { url });
  }

  /**
   * Fetches the image bytes through a permission-checked path. It cannot go straight
   * into an img src, because an img tag does not send the access token.
   */
  content(codePhoto: string): Observable<Blob> {
    return this.http.get(`${this.base}/pet-photos/${codePhoto}/content`, {
      responseType: 'blob',
    });
  }

  restore(codePhoto: string, operation: RestoreOperation[]): Observable<PetPhoto> {
    return this.http.post<PetPhoto>(`${this.base}/pet-photos/${codePhoto}/restore`, {
      operation,
    });
  }

  /**
   * Sends one photograph to be cleaned up, with no pet attached.
   *
   * The restoration screen stands on its own, so nothing here needs a profile.
   * The caller decides afterwards whether to keep the result.
   */
  restoreFresh(file: File, operation: RestoreOperation[]): Observable<RestorationPair> {
    const form = new FormData();
    form.append('file', file, file.name);
    for (const one of operation) {
      form.append('operation[]', one);
    }
    return this.http.post<RestorationPair>(`${this.base}/pet-photos/restoration`, form);
  }

  /** Restored pictures that no pet has claimed yet. */
  listLoose(): Observable<PetPhoto[]> {
    return this.http.get<PetPhoto[]>(`${this.base}/pet-photos/restoration`);
  }

  /** Moves a loose picture onto a pet profile. */
  attach(codePhoto: string, petId: string): Observable<PetPhoto> {
    return this.http.post<PetPhoto>(`${this.base}/pet-photos/${codePhoto}/attach`, {
      pet: petId,
    });
  }

  confirm(codePhoto: string, accept: boolean): Observable<PetPhoto> {
    return this.http.post<PetPhoto>(`${this.base}/pet-photos/${codePhoto}/confirm`, { accept });
  }

  hide(codePhoto: string): Observable<PetPhoto> {
    return this.http.delete<PetPhoto>(`${this.base}/pet-photos/${codePhoto}`);
  }
}
