import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { DecorItem, Memory } from '../../../core/models/api.model';
import {
  DECOR_COLORS,
  FONT_ORDER,
  FONT_LABEL_KEY,
  FontKey,
  PAPER_KEY,
  PAPER_ORDER,
  PaperKind,
  STICKERS,
  stickerOf,
} from '../../../shared/diary-art';
import { AlbumShot } from '../memories-facade';
import { Icon } from '../../../shared/icon/icon';

/** Nhung gi hop bay tri can biet de mo mot trang ra sua. */
export interface PageEditRequest {
  moment: Memory;
  shots: AlbumShot[];
}

/** Ket qua tra ve khi nguoi dung luu trang. */
export interface PageEditResult {
  momentId: string;
  decor: DecorItem[];
  paper: PaperKind;
}

/** Nhieu nhat bao nhieu mon do dat duoc len mot trang, dung nhu may chu. */
const DECOR_MAX = 40;

/** Chu mac dinh cua mot o chu moi. */
const FIRST_WORDS = '...';

/**
 * Bay tri mot trang so: viet chu, dan anh, dat hinh trang tri.
 *
 * Trang duoc mo phang ra de sua, khong sua ngay tren quyen dang lat, vi keo
 * tha mot mon do tren mot mat phang dang nghieng trong khong gian la viec
 * rat kho nham trung.
 *
 * Moi vi tri deu ghi theo phan tram cua trang, nen trang sua o man hinh nao
 * thi bay ra man hinh khac van y nguyen.
 */
@Component({
  selector: 'pm-page-editor',
  standalone: true,
  imports: [TranslatePipe, Icon],
  templateUrl: './page-editor.html',
  styleUrl: './page-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageEditor {
  private readonly ref = inject(MatDialogRef<PageEditor, PageEditResult>);
  private readonly data = inject<PageEditRequest>(MAT_DIALOG_DATA);

  readonly papers = PAPER_ORDER.map((one) => ({ value: one, key: PAPER_KEY[one] }));
  readonly fonts = FONT_ORDER.map((one) => ({ value: one, key: FONT_LABEL_KEY[one] }));
  readonly stickers = STICKERS;
  readonly colors = DECOR_COLORS;
  readonly shots = this.data.shots;
  readonly limit = DECOR_MAX;

  readonly items = signal<DecorItem[]>(
    (this.data.moment.decor ?? []).map((one) => ({ ...one })),
  );

  readonly paper = signal<PaperKind>((this.data.moment.paper ?? 'CREAM') as PaperKind);
  readonly picked = signal(-1);
  readonly tray = signal<'TEXT' | 'PHOTO' | 'STICKER'>('TEXT');

  /**
   * Dang co mon nao bi cam keo hay khong.
   *
   * Trong luc keo, cac mon tren trang thoi nhan chuot, de moi chuyen dong
   * roi xuong chinh to giay va toa do doc duoc la toa do tren to giay.
   */
  readonly dragging = signal(false);

  /** Mon do dang duoc chon, hoac khong co gi. */
  readonly chosen = computed<DecorItem | null>(() => this.items()[this.picked()] ?? null);

  readonly paperClass = computed(() => `paper-${this.paper().toLowerCase()}`);

  readonly full = computed(() => this.items().length >= DECOR_MAX);

  /** Duong ve cua mot hinh trang tri, de khuon mau khong phai tu tra. */
  pathOf(code: string): string {
    return stickerOf(code)?.path ?? '';
  }

  sourceOf(photoId: string | null): string {
    return this.shots.find((one) => one.id === photoId)?.source ?? '';
  }

  /** Mon do nao nam tren cung, de mon moi them luon nhin thay duoc. */
  private topLayer(): number {
    return this.items().reduce((high, one) => Math.max(high, one.z), 0) + 1;
  }

  /**
   * Cho mon moi lech di mot chut so voi mon truoc.
   *
   * Dat chung vao cung mot cho thi mon sau che khuat mon truoc, va nguoi
   * dung tuong la bam khong an. Lech di vai phan tram la nhin thay ngay.
   */
  private nudgeOf(): number {
    return (this.items().length % 6) * 7;
  }

  addText(): void {
    this.add({
      kind: 'TEXT',
      x: 10 + this.nudgeOf(),
      y: 18 + this.nudgeOf(),
      width: 44,
      rotate: 0,
      z: this.topLayer(),
      text: FIRST_WORDS,
      photo: null,
      sticker: '',
      color: DECOR_COLORS[0],
      fontKey: 'HAND',
    });
  }

  addPhoto(photoId: string): void {
    this.add({
      kind: 'PHOTO',
      x: 8 + this.nudgeOf(),
      y: 12 + this.nudgeOf(),
      width: 40,
      rotate: -3,
      z: this.topLayer(),
      text: '',
      photo: photoId,
      sticker: '',
      color: '',
      fontKey: '',
    });
  }

  addSticker(code: string): void {
    this.add({
      kind: 'STICKER',
      x: 30 + this.nudgeOf(),
      y: 34 + this.nudgeOf(),
      width: 14,
      rotate: 0,
      z: this.topLayer(),
      text: '',
      photo: null,
      sticker: code,
      color: DECOR_COLORS[2],
      fontKey: '',
    });
  }

  private add(one: DecorItem): void {
    if (this.full()) {
      return;
    }
    this.items.set([...this.items(), one]);
    this.picked.set(this.items().length - 1);
  }

  pick(at: number): void {
    this.picked.set(at);
  }

  drop(): void {
    const at = this.picked();
    if (at < 0) {
      return;
    }
    this.items.set(this.items().filter((_, i) => i !== at));
    this.picked.set(-1);
  }

  /** Dua mon dang chon len tren cung hoac xuong duoi cung. */
  layer(step: number): void {
    this.change((one) => ({ ...one, z: Math.min(200, Math.max(0, one.z + step * 5)) }));
  }

  setWidth(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.change((one) => ({ ...one, width: value }));
  }

  setRotate(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.change((one) => ({ ...one, rotate: value }));
  }

  setText(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.change((one) => ({ ...one, text: value }));
  }

  setColor(color: string): void {
    this.change((one) => ({ ...one, color }));
  }

  setFont(font: FontKey): void {
    this.change((one) => ({ ...one, fontKey: font }));
  }

  setPaper(kind: PaperKind): void {
    this.paper.set(kind);
  }

  showTray(which: 'TEXT' | 'PHOTO' | 'STICKER'): void {
    this.tray.set(which);
  }

  /**
   * Keo mot mon do tren trang.
   *
   * Toa do duoc doi sang phan tram ngay tai day bang be rong that cua trang,
   * vi trang co the rong hep khac nhau tuy man hinh, con vi tri thi phai
   * luu theo phan tram de bay ra man hinh nao cung dung cho.
   */
  dragMove(event: PointerEvent): void {
    if (this.picked() < 0 || !this.dragging()) {
      return;
    }
    const surface = event.currentTarget as HTMLElement;
    const wide = surface.clientWidth;
    const tall = surface.clientHeight;
    if (wide === 0 || tall === 0) {
      return;
    }
    const x = ((event.offsetX - this.grabX) / wide) * 100;
    const y = ((event.offsetY - this.grabY) / tall) * 100;
    this.change((one) => ({
      ...one,
      x: Math.min(110, Math.max(-10, Math.round(x))),
      y: Math.min(110, Math.max(-10, Math.round(y))),
    }));
  }

  private grabX = 0;
  private grabY = 0;

  /** Bat dau keo. Ghi lai diem cam tren chinh mon do, de no khong nhay. */
  dragStart(at: number, event: PointerEvent): void {
    this.picked.set(at);
    this.grabX = event.offsetX;
    this.grabY = event.offsetY;
    this.dragging.set(true);
  }

  dragEnd(): void {
    this.dragging.set(false);
  }

  /** Di chuyen mon dang chon bang ban phim, moi lan mot phan tram. */
  nudge(dx: number, dy: number): void {
    this.change((one) => ({
      ...one,
      x: Math.min(110, Math.max(-10, one.x + dx)),
      y: Math.min(110, Math.max(-10, one.y + dy)),
    }));
  }

  private change(how: (one: DecorItem) => DecorItem): void {
    const at = this.picked();
    if (at < 0) {
      return;
    }
    this.items.set(this.items().map((one, i) => (i === at ? how(one) : one)));
  }

  save(): void {
    this.ref.close({
      momentId: this.data.moment._id,
      decor: this.items(),
      paper: this.paper(),
    });
  }

  close(): void {
    this.ref.close();
  }
}
