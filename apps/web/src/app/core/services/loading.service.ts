import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private activeCount = 0;

  /** Trang thai loading toan cuc */
  readonly isLoading = signal<boolean>(false);

  /** Thong diep tuy bien hien thi duoi spinner */
  readonly message = signal<string>('');

  show(customMessage?: string): void {
    this.activeCount++;
    if (customMessage) {
      this.message.set(customMessage);
    }
    this.isLoading.set(true);
  }

  hide(): void {
    if (this.activeCount > 0) {
      this.activeCount--;
    }
    if (this.activeCount === 0) {
      this.isLoading.set(false);
      this.message.set('');
    }
  }

  forceHide(): void {
    this.activeCount = 0;
    this.isLoading.set(false);
    this.message.set('');
  }
}
