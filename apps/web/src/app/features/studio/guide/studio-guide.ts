import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../../shared/icon/icon';

/** Mot buoc chi dan: tro vao mot vung tren trang (theo selector) kem tieu de va noi dung. */
export interface GuideStep {
  /** Selector cua vung can lam noi bat; vung khong con tren trang thi buoc bi bo qua. */
  target: string;
  titleKey: string;
  bodyKey: string;
}

const POPOVER_W = 340;
const POPOVER_H = 210;
const GAP = 14;
const PAD = 8;
const EDGE = 12;
const NARROW = 640;

/**
 * Lop huong dan phu len trang thiet ke: lam toi nen, khoet sang mot vung va dat bang giai thich ben canh.
 * Bam Esc hoac "Bo qua" de dong; mui ten trai/phai de chuyen buoc. Trang goi lai bang nut "Huong dan".
 */
@Component({
  selector: 'pm-studio-guide',
  standalone: true,
  imports: [TranslatePipe, Icon],
  templateUrl: './studio-guide.html',
  styleUrl: './studio-guide.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudioGuide implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly popover = viewChild<ElementRef<HTMLElement>>('popover');

  /** Cac buoc muon chi; buoc nao khong tim thay vung tren trang se tu bo qua. */
  readonly steps = input.required<GuideStep[]>();

  /** Dong lop huong dan (nguoi dung bam Bo qua, Da hieu, hoac Esc). */
  readonly closed = output<void>();

  readonly shown = signal<GuideStep[]>([]);
  readonly index = signal(0);
  private readonly area = signal<DOMRect | null>(null);
  private readonly view = signal({ w: window.innerWidth, h: window.innerHeight });

  readonly current = computed(() => this.shown()[this.index()] ?? null);
  readonly last = computed(() => this.index() >= this.shown().length - 1);
  readonly dots = computed(() => this.shown().map((_, i) => i));

  /** Khung sang quanh vung dang chi, nhich ra ngoai mot chut cho de nhin. */
  readonly spot = computed(() => {
    const r = this.area();
    return r
      ? { top: r.top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD }
      : null;
  });

  /** Vi tri bang giai thich: canh vung dang chi neu du cho, man hep thi ghim tren hoac duoi. */
  readonly popStyle = computed(() => {
    const { w, h } = this.view();
    const s = this.spot();
    if (w < NARROW) {
      const onBottomHalf = s ? s.top + s.height / 2 > h / 2 : false;
      return onBottomHalf ? { top: `${EDGE}px`, left: `${EDGE}px`, right: `${EDGE}px` } : { bottom: `${EDGE}px`, left: `${EDGE}px`, right: `${EDGE}px` };
    }
    if (!s) {
      return { top: `${(h - POPOVER_H) / 2}px`, left: `${(w - POPOVER_W) / 2}px` };
    }
    const clampX = (x: number) => Math.min(Math.max(x, EDGE), w - POPOVER_W - EDGE);
    const clampY = (y: number) => Math.min(Math.max(y, EDGE), h - POPOVER_H - EDGE);
    const midY = clampY(s.top + s.height / 2 - POPOVER_H / 2);
    const midX = clampX(s.left + s.width / 2 - POPOVER_W / 2);
    const fitsRight = s.left + s.width + GAP + POPOVER_W + EDGE <= w;
    const fitsLeft = s.left - GAP - POPOVER_W - EDGE >= 0;
    const fitsBelow = s.top + s.height + GAP + POPOVER_H + EDGE <= h;
    const fitsAbove = s.top - GAP - POPOVER_H - EDGE >= 0;
    // Vung rat to (nhu ca san khau) thi dat bang vao ben trong, goc duoi ben phai, tranh de len be 3D o giua.
    const huge = s.width > w * 0.5 && s.height > h * 0.55;
    if (huge) {
      return { top: `${clampY(s.top + s.height - POPOVER_H - 24)}px`, left: `${clampX(s.left + s.width - POPOVER_W - 24)}px` };
    }
    if (fitsLeft) return { top: `${midY}px`, left: `${s.left - GAP - POPOVER_W}px` };
    if (fitsRight) return { top: `${midY}px`, left: `${s.left + s.width + GAP}px` };
    if (fitsBelow) return { top: `${s.top + s.height + GAP}px`, left: `${midX}px` };
    if (fitsAbove) return { top: `${s.top - GAP - POPOVER_H}px`, left: `${midX}px` };
    return { top: `${midY}px`, left: `${midX}px` };
  });

  private previouslyFocused: HTMLElement | null = null;

  constructor() {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
  }

  ngAfterViewInit(): void {
    // Chi giu cac buoc co vung that tren trang.
    const found = this.steps().filter((one) => document.querySelector(one.target));
    this.shown.set(found);
    if (found.length === 0) {
      this.close();
      return;
    }
    this.focusStep();
  }

  ngOnDestroy(): void {
    this.previouslyFocused?.focus?.();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  measure(): void {
    this.view.set({ w: window.innerWidth, h: window.innerHeight });
    const step = this.current();
    const el = step ? document.querySelector(step.target) : null;
    this.area.set(el ? el.getBoundingClientRect() : null);
  }

  next(): void {
    if (this.last()) {
      this.close();
      return;
    }
    this.index.update((i) => i + 1);
    this.focusStep();
  }

  prev(): void {
    if (this.index() > 0) {
      this.index.update((i) => i - 1);
      this.focusStep();
    }
  }

  close(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (event.key === 'ArrowRight') {
      this.next();
    } else if (event.key === 'ArrowLeft') {
      this.prev();
    } else if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  /** Giu phim Tab quay vong trong bang giai thich de khong lac ra sau lop toi. */
  private trapFocus(event: KeyboardEvent): void {
    const pop = this.popover()?.nativeElement;
    if (!pop) return;
    const items = Array.from(pop.querySelectorAll<HTMLElement>('button:not([disabled])'));
    if (items.length === 0) return;
    const first = items[0];
    const lastItem = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && active === lastItem) {
      event.preventDefault();
      first.focus();
    } else if (!pop.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Cuon vung dang chi vao tam man hinh, do lai vi tri, dua tieu diem ve nut "Tiep". */
  private focusStep(): void {
    const step = this.current();
    const el = step ? document.querySelector(step.target) : null;
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    this.measure();
    // Doi bang giai thich ve dung cho roi moi dua tieu diem vao.
    setTimeout(() => this.popover()?.nativeElement.querySelector<HTMLElement>('.go')?.focus(), 60);
    // Cuon xong vi tri co the doi nhe nen do lai lan nua.
    setTimeout(() => this.measure(), 320);
  }
}
