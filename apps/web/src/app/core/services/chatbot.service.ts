import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import { AssistantAnswer, ChatSession } from '../models/api.model';

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

  // --- Muc 18: ban day du, co nho ngu canh va chuyen duoc sang nguoi that ---

  /** Mo mot phien moi. Khach chua dang nhap cung mo duoc. */
  openSession(): Observable<ChatSession> {
    return this.http.post<ChatSession>(`${this.base}/assistant/sessions`, {});
  }

  /** Phien dang mo gan nhat cua nguoi dang dang nhap, hoac rong neu chua co. */
  mySession(): Observable<ChatSession | null> {
    return this.http.get<ChatSession | null>(`${this.base}/assistant/sessions/mine`);
  }

  readSession(code: string): Observable<ChatSession> {
    return this.http.get<ChatSession>(`${this.base}/assistant/sessions/${code}`);
  }

  askInSession(code: string, question: string): Observable<ChatSession> {
    return this.http.post<ChatSession>(`${this.base}/assistant/sessions/${code}/ask`, { question });
  }

  /** Xin gap tu van vien. */
  handover(code: string, note: string): Observable<ChatSession> {
    return this.http.post<ChatSession>(`${this.base}/assistant/sessions/${code}/handover`, { note });
  }

  // --- Phia nhan vien truc ---

  waitingChats(): Observable<ChatSession[]> {
    return this.http.get<ChatSession[]>(`${this.base}/admin/chats`);
  }

  staffRead(code: string): Observable<ChatSession> {
    return this.http.get<ChatSession>(`${this.base}/admin/chats/${code}`);
  }

  takeChat(code: string): Observable<ChatSession> {
    return this.http.post<ChatSession>(`${this.base}/admin/chats/${code}/take`, {});
  }

  staffReply(code: string, text: string): Observable<ChatSession> {
    return this.http.post<ChatSession>(`${this.base}/admin/chats/${code}/reply`, { text });
  }

  closeChat(code: string): Observable<ChatSession> {
    return this.http.post<ChatSession>(`${this.base}/admin/chats/${code}/close`, {});
  }
}
