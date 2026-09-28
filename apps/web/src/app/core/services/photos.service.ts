import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import {
  PetPhoto,
  PhotoAngle,
  AngleCheckResult,
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

  confirm(codePhoto: string, accept: boolean): Observable<PetPhoto> {
    return this.http.post<PetPhoto>(`${this.base}/pet-photos/${codePhoto}/confirm`, { accept });
  }

  hide(codePhoto: string): Observable<PetPhoto> {
    return this.http.delete<PetPhoto>(`${this.base}/pet-photos/${codePhoto}`);
  }
}
