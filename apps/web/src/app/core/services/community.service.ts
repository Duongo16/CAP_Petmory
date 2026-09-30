import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import {
  CommunityPost,
  CommunityProfile,
  FeedPage,
  FeedScope,
  PostComment,
  PostDetail,
  PostTopic,
  WritePostInput,
} from '../models/community.model';

export interface FeedQuery {
  topic?: PostTopic | null;
  keyword?: string;
  scope?: FeedScope;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class CommunityService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  feed(query: FeedQuery): Observable<FeedPage> {
    let params = new HttpParams();
    if (query.topic) {
      params = params.set('topic', query.topic);
    }
    if (query.keyword?.trim()) {
      params = params.set('keyword', query.keyword.trim());
    }
    if (query.scope && query.scope !== 'ALL') {
      params = params.set('scope', query.scope);
    }
    if (query.page && query.page > 1) {
      params = params.set('page', query.page);
    }
    return this.http.get<FeedPage>(`${this.base}/community/posts`, { params });
  }

  topicCounts(): Observable<Record<PostTopic, number>> {
    return this.http.get<Record<PostTopic, number>>(`${this.base}/community/topics`);
  }

  detail(id: string): Observable<PostDetail> {
    return this.http.get<PostDetail>(`${this.base}/community/posts/${id}`);
  }

  comments(id: string): Observable<PostComment[]> {
    return this.http.get<PostComment[]>(`${this.base}/community/posts/${id}/comments`);
  }

  write(input: WritePostInput): Observable<{ _id: string }> {
    return this.http.post<{ _id: string }>(`${this.base}/community/posts`, input);
  }

  addPhoto(id: string, file: Blob, fileName: string): Observable<unknown> {
    const form = new FormData();
    form.append('file', file, fileName);
    return this.http.post(`${this.base}/community/posts/${id}/photos`, form);
  }

  /** Nho may chu tai buc anh o duong dan tren mang ve, thay cho tep tren may. */
  addPhotoByLink(id: string, url: string): Observable<unknown> {
    return this.http.post(`${this.base}/community/posts/${id}/photos/from-link`, { url });
  }

  comment(id: string, content: string): Observable<unknown> {
    return this.http.post(`${this.base}/community/posts/${id}/comments`, { content });
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/community/posts/${id}`);
  }

  toggleLike(id: string): Observable<{ liked: boolean; likeCount: number }> {
    return this.http.post<{ liked: boolean; likeCount: number }>(
      `${this.base}/community/posts/${id}/like`,
      {},
    );
  }

  toggleSave(id: string): Observable<{ saved: boolean }> {
    return this.http.post<{ saved: boolean }>(`${this.base}/community/posts/${id}/save`, {});
  }

  toggleFollow(userId: string): Observable<{ following: boolean }> {
    return this.http.post<{ following: boolean }>(
      `${this.base}/community/users/${userId}/follow`,
      {},
    );
  }

  profile(userId: string): Observable<CommunityProfile> {
    return this.http.get<CommunityProfile>(`${this.base}/community/users/${userId}`);
  }

  postsOf(userId: string): Observable<CommunityPost[]> {
    return this.http.get<CommunityPost[]>(`${this.base}/community/users/${userId}/posts`);
  }

  updateProfile(data: { fullName?: string; phone?: string; avatarUrl?: string }): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.base}/community/users/me`, data);
  }

  /** Where a post photo is served from, for use in an image source. */
  photoUrl(postId: string, fileName: string): string {
    return `${this.base}/community/posts/${postId}/photos/${fileName}`;
  }
}
