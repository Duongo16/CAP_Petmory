import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'pm-finished-showcase',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './finished-showcase.html',
  styleUrl: './finished-showcase.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinishedShowcase implements OnDestroy {
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Anh thanh pham (nen da tach, can thang) */
  readonly imageSrc = input<string>('/img/4landing/border-collie-isolated.png');

  /** Doi gia tri moi lan vao buoc nay de phat lai man ra mat */
  readonly revealTrigger = input<number>(0);

  /** Ten be khac tren bang dong */
  readonly petName = input<string>('');

  /** Ngay ky niem khac tren bang dong */
  readonly memorialDate = input<string | null>(null);

  // Goc nghieng khung theo con tro, vi tri vet sang tren kinh
  readonly tiltX = signal(0);
  readonly tiltY = signal(0);
  readonly sheenX = signal(70);
  readonly sheenY = signal(20);

  /** Bat len moi lan phat man; CSS dung class nay de chay chuoi animation */
  readonly isRevealing = signal(false);

  /** Khung dang dung dua sau khi bi cham vao */
  readonly wobbling = signal(false);

  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.revealTrigger();
      this.replay();
    });
  }

  ngOnDestroy(): void {
    if (this.restartTimer) clearTimeout(this.restartTimer);
  }

  /** Tat roi bat lai class de CSS animation chay lai tu dau. */
  replay(): void {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.isRevealing.set(false);
    this.wobbling.set(false);
    this.restartTimer = setTimeout(() => this.isRevealing.set(true), 60);
  }

  /** Cham vao khung: khung dung dua nhu dang treo tren tuong. */
  wobble(): void {
    this.wobbling.set(false);
    // Tach hai nhip de animation chay lai du bam lien tiep
    requestAnimationFrame(() => this.wobbling.set(true));
  }

  onPointerMove(event: PointerEvent): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const nx = (event.clientX - rect.left) / rect.width - 0.5;
    const ny = (event.clientY - rect.top) / rect.height - 0.5;

    this.tiltY.set(Math.round(nx * 120) / 10);
    this.tiltX.set(Math.round(-ny * 100) / 10);
    this.sheenX.set(Math.round(50 + nx * 100));
    this.sheenY.set(Math.round(50 + ny * 100));
  }

  onPointerLeave(): void {
    this.tiltX.set(0);
    this.tiltY.set(0);
    this.sheenX.set(70);
    this.sheenY.set(20);
  }
}
