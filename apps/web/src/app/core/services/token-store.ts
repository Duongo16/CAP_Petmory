import { Injectable, signal } from '@angular/core';
import { User } from '../models/api.model';

const KEY_ACCESS = 'petmory.access';
const KEY_REFRESH = 'petmory.refresh';
const KEY_USER = 'petmory.user';

/**
 * Stores the sign-in session on the browser side.
 * Every read and write is wrapped in a try/catch, because a browser in private
 * mode can block access to local storage.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  readonly user = signal<User | null>(this.readUser());

  getAccessToken(): string | null {
    return this.read(KEY_ACCESS);
  }

  getRefreshToken(): string | null {
    return this.read(KEY_REFRESH);
  }

  save(accessToken: string, refreshToken: string, user: User): void {
    this.write(KEY_ACCESS, accessToken);
    this.write(KEY_REFRESH, refreshToken);
    this.write(KEY_USER, JSON.stringify(user));
    this.user.set(user);
  }

  remove(): void {
    this.write(KEY_ACCESS, null);
    this.write(KEY_REFRESH, null);
    this.write(KEY_USER, null);
    this.user.set(null);
  }

  private readUser(): User | null {
    const raw = this.read(KEY_USER);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string | null): void {
    try {
      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    } catch {
      return;
    }
  }
}
