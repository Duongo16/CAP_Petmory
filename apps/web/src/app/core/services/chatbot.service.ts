import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import { AssistantAnswer, ChatSession } from '../models/api.model';

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  /** Tro chuyen co cho bao dang tra loi rieng, nen khong bat lop cho toan man hinh. */
  private readonly quiet = { headers: new HttpHeaders({ 'X-Skip-Loading': '1' }) };

  ask(question: string): Observable<AssistantAnswer> {
    return this.http.post<AssistantAnswer>(`${this.base}/assistant/ask`, { question }, this.quiet);
  }

  // --- Muc 18: ban day du, co nho ngu canh va chuyen duoc sang nguoi that ---

  /** Mo mot phien moi cho nguoi dang dang nhap. */
  openSession(): Observable<ChatSession> {
    return this.http.post<ChatSession>(`${this.base}/assistant/sessions`, {}, this.quiet);
  }

  /** Phien dang mo gan nhat cua nguoi dang dang nhap, hoac rong neu chua co. */
  mySession(): Observable<ChatSession | null> {
    return this.http.get<ChatSession | null>(`${this.base}/assistant/sessions/mine`, this.quiet);
  }

  readSession(code: string): Observable<ChatSession> {
    return this.http.get<ChatSession>(`${this.base}/assistant/sessions/${code}`, this.quiet);
  }

  askInSession(code: string, question: string): Observable<ChatSession> {
    return this.http.post<ChatSession>(`${this.base}/assistant/sessions/${code}/ask`, { question }, this.quiet);
  }

  /** Xin gap tu van vien. */
  handover(code: string, note: string): Observable<ChatSession> {
    return this.http.post<ChatSession>(`${this.base}/assistant/sessions/${code}/handover`, { note }, this.quiet);
  }

  // --- Phia nhan vien truc ---

  waitingChats(): Observable<ChatSession[]> {
    return this.http.get<ChatSession[]>(`${this.base}/admin/chats`, this.quiet);
  }

  staffRead(code: string): Observable<ChatSession> {
    return this.http.get<ChatSession>(`${this.base}/admin/chats/${code}`, this.quiet);
  }

  takeChat(code: string): Observable<ChatSession> {
    return this.http.post<ChatSession>(`${this.base}/admin/chats/${code}/take`, {}, this.quiet);
  }

  staffReply(code: string, text: string): Observable<ChatSession> {
    return this.http.post<ChatSession>(`${this.base}/admin/chats/${code}/reply`, { text }, this.quiet);
  }

  closeChat(code: string): Observable<ChatSession> {
    return this.http.post<ChatSession>(`${this.base}/admin/chats/${code}/close`, {}, this.quiet);
  }
}
