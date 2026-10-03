import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';

export type KnowledgeTopic =
  | 'PRODUCT'
  | 'SIZE'
  | 'LEAD_TIME'
  | 'ORDER'
  | 'PAYMENT'
  | 'SHIPPING'
  | 'POLICY'
  | 'OTHER';

/** Mot muc trong kho tri thuc cua tro ly. */
export interface KnowledgeEntry {
  code: string;
  question: string;
  keywords: string[];
  answer: string;
  link: string;
  topic: KnowledgeTopic;
  followUp: string[];
  starter: boolean;
  enabled: boolean;
  sortOrder: number;
  updatedAt?: string;
}

export type KnowledgeInput = Omit<KnowledgeEntry, 'updatedAt'>;

/** Kho tri thuc cua tro ly, chi nhom Quan ly sua duoc. */
@Injectable({ providedIn: 'root' })
export class AssistantKnowledgeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE)}/admin/assistant/knowledge`;

  list(topic?: KnowledgeTopic | null, keyword?: string): Observable<KnowledgeEntry[]> {
    let params = new HttpParams();
    if (topic) {
      params = params.set('topic', topic);
    }
    if (keyword?.trim()) {
      params = params.set('keyword', keyword.trim());
    }
    return this.http.get<KnowledgeEntry[]>(this.base, { params });
  }

  create(input: KnowledgeInput): Observable<KnowledgeEntry> {
    return this.http.post<KnowledgeEntry>(this.base, input);
  }

  update(code: string, input: Partial<KnowledgeInput>): Observable<KnowledgeEntry> {
    const { code: _ignored, ...rest } = input;
    return this.http.patch<KnowledgeEntry>(`${this.base}/${code}`, rest);
  }

  hide(code: string): Observable<KnowledgeEntry> {
    return this.http.delete<KnowledgeEntry>(`${this.base}/${code}`);
  }
}
