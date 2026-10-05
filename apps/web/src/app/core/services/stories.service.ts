import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import { PetStory, QuotaLeft, StoryTone } from '../models/api.model';

/** Cau chuyen AI ve tung be: viet, viet lai, sua tay, gan vao nhat ky. */
@Injectable({ providedIn: 'root' })
export class StoriesService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  list(petId: string): Observable<PetStory[]> {
    return this.http.get<PetStory[]>(`${this.base}/pet-stories`, { params: new HttpParams().set('petId', petId) });
  }

  quota(): Observable<QuotaLeft> {
    return this.http.get<QuotaLeft>(`${this.base}/pet-stories/quota`);
  }

  write(petId: string, tone: StoryTone, notes: string): Observable<PetStory> {
    return this.http.post<PetStory>(`${this.base}/pet-stories`, { petId, tone, notes });
  }

  rewrite(id: string, notes: string): Observable<PetStory> {
    return this.http.post<PetStory>(`${this.base}/pet-stories/${id}/rewrite`, { notes });
  }

  edit(id: string, title: string, content: string): Observable<PetStory> {
    return this.http.patch<PetStory>(`${this.base}/pet-stories/${id}`, { title, content });
  }

  attach(id: string, memoryId: string): Observable<PetStory> {
    return this.http.post<PetStory>(`${this.base}/pet-stories/${id}/attach`, { memoryId });
  }

  remove(id: string): Observable<PetStory> {
    return this.http.delete<PetStory>(`${this.base}/pet-stories/${id}`);
  }
}
