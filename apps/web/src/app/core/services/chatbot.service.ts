import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import { AssistantAnswer } from '../models/api.model';

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  ask(question: string): Observable<AssistantAnswer> {
    return this.http.post<AssistantAnswer>(`${this.base}/assistant/ask`, { question });
  }

  initialSuggestions(): Observable<{ suggestion: string[] }> {
    return this.http.get<{ suggestion: string[] }>(`${this.base}/assistant/suggestions`);
  }
}
