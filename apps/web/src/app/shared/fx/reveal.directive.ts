import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

/**
 * Hien phan tu khi cuon toi.
 *
 * Chi khi directive chay moi danh dau "data-reveal", nen khong co JavaScript thi
 * noi dung van hien du. Khi phan tu lot vao khung nhin thi them "is-shown" mot
 * lan; kieu dang cua trang quyet dinh hien ra the nao (rot xuong, nay len...).
 * Nguoi dung chon giam chuyen dong thi hien ngay, khong dien hoat.
 */
@Directive({
  selector: '[pmReveal]',
  standalone: true,
})
export class RevealDirective {
  /** Tre bao lau (ms) sau khi lot vao khung nhin, de cac phan tu canh nhau hien noi duoi. */
  readonly pmRevealDelay = input(0);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.host.nativeElement;
      el.style.setProperty('--reveal-delay', `${this.pmRevealDelay()}ms`);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
        el.classList.add('is-shown');
        return;
      }
      el.dataset['reveal'] = '';
      const watch = new IntersectionObserver(
        (entries) => {
          if (entries.some((one) => one.isIntersecting)) {
            el.classList.add('is-shown');
            watch.disconnect();
          }
        },
        { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
      );
      watch.observe(el);
      destroyRef.onDestroy(() => watch.disconnect());
    });
  }
}
