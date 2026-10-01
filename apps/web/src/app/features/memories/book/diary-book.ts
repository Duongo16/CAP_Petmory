import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { PageFace, PageFaceView } from './page-face';
import { Icon } from '../../../shared/icon/icon';

/** Mot to giay trong quyen: mat truoc va mat sau. */
interface Leaf {
  at: number;
  front: PageFace;
  back: PageFace | null;
}

/**
 * Cao hon so to giay nhieu nhat mot quyen co the co, dung de xep thu tu
 * chong len nhau cho cac to chua lat.
 */
const STACK_TOP = 400;

/**
 * Duoi be rong nay thi chi mo mot trang mot luc.
 *
 * Hai trang canh nhau tren man hinh dien thoai thi chu be den muc khong doc
 * noi, va nguoi doc se bo qua mot nua so trang ma khong biet.
 */
const NARROW = '(max-width: 760px)';

/** How far the pointer must travel before a press becomes a drag. */
const DRAG_START_PX = 6;

/** Past this share of the way across, letting go finishes the turn. */
const TURN_AT = 0.33;

/** How far a swipe must go on a phone to change page. */
const SWIPE_PX = 48;

/** A page being turned by hand: which leaf, which way, and how far along. */
interface Drag {
  leaf: number;
  forward: boolean;
  progress: number;
}

/** Where a press began, kept until it turns into a drag or is let go. */
interface Press {
  x: number;
  width: number;
  leaf: number;
  forward: boolean;
  moving: boolean;
}

/**
 * Quyen so ky niem, lat duoc tung trang.
 *
 * Moi to giay la mot mat phang quay quanh gay sach, nen lat trang la mot
 * chuyen dong that trong khong gian chu khong phai anh truot ngang. To da
 * lat nam ben trai, to chua lat nam ben phai, dung nhu mot quyen so that.
 */
@Component({
  selector: 'pm-diary-book',
  standalone: true,
  imports: [TranslatePipe, PageFaceView, Icon],
  templateUrl: './diary-book.html',
  styleUrl: './diary-book.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiaryBookView {
  private readonly widthWatch = inject(BreakpointObserver);

  /** Man hinh co hep den muc chi mo duoc mot trang mot luc khong. */
  readonly narrow = toSignal(
    this.widthWatch.observe(NARROW).pipe(map((seen) => seen.matches)),
    { initialValue: false },
  );

  readonly faces = input.required<PageFace[]>();
  readonly sourceOf = input.required<Record<string, string>>();

  /** Nguoi dang xem co duoc bay tri trang khong. */
  readonly canEdit = input(false);

  /** Bao ra ngoai khi nguoi dung muon bay tri mot trang. */
  readonly editWanted = output<PageFace>();

  /** Da lat bao nhieu to giay, dung cho man hinh rong. */
  readonly turned = signal(0);

  /** Dang mo trang thu may, dung cho man hinh hep. */
  readonly pageAt = signal(0);

  /** The page being turned by hand right now, if any. */
  readonly drag = signal<Drag | null>(null);

  /** The rotation the hand-held page should show, worked out once per move. */
  readonly dragStyle = computed(() => {
    const held = this.drag();
    if (!held) {
      return null;
    }
    const angle = held.forward ? -180 * held.progress : -180 * (1 - held.progress);
    return { leaf: held.leaf, transform: `rotateY(${angle}deg)`, lift: Math.sin(Math.PI * held.progress) };
  });

  private press: Press | null = null;

  readonly leaves = computed<Leaf[]>(() => {
    const all = this.faces();
    const out: Leaf[] = [];
    for (let at = 0; at * 2 < all.length; at += 1) {
      out.push({ at, front: all[at * 2], back: all[at * 2 + 1] ?? null });
    }
    return out;
  });

  readonly leafCount = computed(() => this.leaves().length);

  /** Hai mat dang mo ra truoc mat nguoi doc. */
  readonly leftFace = computed<PageFace | null>(() => {
    const at = this.turned() - 1;
    return at >= 0 ? (this.leaves()[at]?.back ?? null) : null;
  });

  readonly rightFace = computed<PageFace | null>(
    () => this.leaves()[this.turned()]?.front ?? null,
  );

  /** Trang dang mo tren man hinh hep. */
  readonly onePage = computed<PageFace | null>(() => this.faces()[this.pageAt()] ?? null);

  readonly atStart = computed(() =>
    this.narrow() ? this.pageAt() === 0 : this.turned() === 0,
  );

  readonly atEnd = computed(() =>
    this.narrow()
      ? this.pageAt() >= this.faces().length - 1
      : this.turned() >= this.leafCount(),
  );

  /** Vi tri dang doc, viet ra de nguoi doc biet minh dang o dau. */
  readonly whereAt = computed(() =>
    this.narrow() ? this.pageAt() + 1 : this.turned(),
  );

  readonly whereTotal = computed(() =>
    this.narrow() ? this.faces().length : this.leafCount(),
  );

  /**
   * Thu tu chong len nhau cua mot to.
   *
   * To chua lat thi to gan nhat nam tren cung. To da lat thi nguoc lai: to
   * vua lat xong nam tren cung o phia ben trai.
   */
  depthOf(at: number): number {
    return at < this.turned() ? at : STACK_TOP - at;
  }

  isTurned(at: number): boolean {
    return at < this.turned();
  }

  next(): void {
    if (this.atEnd()) {
      return;
    }
    if (this.narrow()) {
      this.pageAt.set(this.pageAt() + 1);
      return;
    }
    this.turned.set(this.turned() + 1);
  }

  previous(): void {
    if (this.atStart()) {
      return;
    }
    if (this.narrow()) {
      this.pageAt.set(this.pageAt() - 1);
      return;
    }
    this.turned.set(this.turned() - 1);
  }

  /**
   * A press on the book. On the right half it picks up the next page, on the
   * left half the one just turned, the way a hand reaches for a real book.
   */
  grab(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const forward = event.clientX > box.left + box.width / 2;
    if (!this.narrow() && (forward ? this.atEnd() : this.atStart())) {
      return;
    }
    this.press = {
      x: event.clientX,
      width: this.narrow() ? box.width : box.width / 2,
      leaf: forward ? this.turned() : this.turned() - 1,
      forward,
      moving: false,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  move(event: PointerEvent): void {
    const press = this.press;
    if (!press || this.narrow()) {
      return;
    }
    const travelled = event.clientX - press.x;
    if (!press.moving && Math.abs(travelled) < DRAG_START_PX) {
      return;
    }
    press.moving = true;
    const share = (press.forward ? -travelled : travelled) / press.width;
    this.drag.set({ leaf: press.leaf, forward: press.forward, progress: Math.min(1, Math.max(0, share)) });
  }

  letGo(event: PointerEvent): void {
    const press = this.press;
    this.press = null;
    if (!press) {
      return;
    }
    if (this.narrow()) {
      const travelled = event.clientX - press.x;
      if (travelled <= -SWIPE_PX) {
        this.next();
      } else if (travelled >= SWIPE_PX) {
        this.previous();
      }
      return;
    }
    const held = this.drag();
    this.drag.set(null);
    if (held && held.progress >= TURN_AT) {
      this.turned.set(this.turned() + (held.forward ? 1 : -1));
    }
  }

  /** Mo mot trang bat ky, dem theo so to giay. */
  goTo(leafAt: number): void {
    this.turned.set(Math.min(this.leafCount(), Math.max(0, leafAt)));
  }

  editLeft(): void {
    this.askEdit(this.leftFace());
  }

  editRight(): void {
    this.askEdit(this.narrow() ? this.onePage() : this.rightFace());
  }

  private askEdit(face: PageFace | null): void {
    if (face && face.kind === 'MOMENT') {
      this.editWanted.emit(face);
    }
  }
}
