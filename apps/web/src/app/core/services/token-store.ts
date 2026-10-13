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

  /**
   * Keeps the session after browser restarts only when the user opted in.
   * Sessions without that choice live in sessionStorage and end with the tab.
   */
  save(accessToken: string, refreshToken: string, user: User, remember = this.isPersistent()): void {
    const preferred = remember ? this.local() : this.session();
    const fallback = remember ? this.session() : this.local();

    // A user may switch the checkbox between logins, so never leave a
    // duplicate credential set in the other browser store.
    this.clear(this.local());
    this.clear(this.session());
    if (!this.writeSession(preferred, accessToken, refreshToken, user)) {
      this.clear(preferred);
      this.writeSession(fallback, accessToken, refreshToken, user);
    }
    this.user.set(user);
  }

  patchUser(patch: Partial<User>): void {
    const current = this.user();
    if (!current) {
      return;
    }
    const updated = { ...current, ...patch };
    this.write(this.isPersistent() ? this.local() : this.session(), KEY_USER, JSON.stringify(updated));
    this.user.set(updated);
  }

  remove(): void {
    this.clear(this.local());
    this.clear(this.session());
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
    return this.readFrom(this.local(), key) ?? this.readFrom(this.session(), key);
  }

  private readFrom(storage: Storage | null, key: string): string | null {
    if (!storage) {
      return null;
    }
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(storage: Storage | null, key: string, value: string): boolean {
    if (!storage) {
      return false;
    }
    try {
      storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  private writeSession(storage: Storage | null, accessToken: string, refreshToken: string, user: User): boolean {
    return (
      this.write(storage, KEY_ACCESS, accessToken) &&
      this.write(storage, KEY_REFRESH, refreshToken) &&
      this.write(storage, KEY_USER, JSON.stringify(user))
    );
  }

  private clear(storage: Storage | null): void {
    if (!storage) {
      return;
    }
    try {
      storage.removeItem(KEY_ACCESS);
      storage.removeItem(KEY_REFRESH);
      storage.removeItem(KEY_USER);
    } catch {
      // Storage can be unavailable in private browsing; memory still updates.
    }
  }

  private isPersistent(): boolean {
    return this.readFrom(this.local(), KEY_USER) !== null;
  }

  private local(): Storage | null {
    return this.storage('localStorage');
  }

  private session(): Storage | null {
    return this.storage('sessionStorage');
  }

  private storage(name: 'localStorage' | 'sessionStorage'): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return window[name];
    } catch {
      return null;
    }
  }
}
