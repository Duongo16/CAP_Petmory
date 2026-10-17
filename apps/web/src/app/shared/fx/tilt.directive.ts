import { Directive, ElementRef, HostListener, inject } from '@angular/core';

/**
 * The nghieng theo con tro, nhu cam khung tranh len xoay xem.
 *
 * Chi dat hai bien --rx va --ry (do) cho kieu dang dung; man cham (dien thoai)
 * khong co con tro nen khong nghieng.
 */
@Directive({
  selector: '[pmTilt]',
  standalone: true,
})
export class TiltDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Goc nghieng lon nhat, theo do. */
  private readonly max = 10;

  @HostListener('pointermove', ['$event'])
  move(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') {
      return;
    }
    const el = this.host.nativeElement;
    const box = el.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    el.style.setProperty('--ry', `${(x * this.max * 2).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${(-y * this.max * 2).toFixed(2)}deg`);
  }

  @HostListener('pointerleave')
  leave(): void {
    const el = this.host.nativeElement;
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--rx', '0deg');
  }
}
