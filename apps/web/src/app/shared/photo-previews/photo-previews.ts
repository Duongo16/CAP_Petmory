import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../icon/icon';

/** Mot o xem truoc: anh lay tu tep hoac tu duong dan, kem cho no nam trong danh sach goc. */
interface Tile {
  key: string;
  src: string;
  from: 'FILE' | 'LINK';
  at: number;
}

/**
 * Luoi xem truoc nhung anh vua chon, de nguoi dung thay ngay anh nao da vao va
 * bo di anh chon nham. Tep tren may duoc doi thanh dia chi tam de hien thi, va
 * dia chi do duoc tra lai khi danh sach doi hoac khi o nay bi go di.
 */
@Component({
  selector: 'pm-photo-previews',
  standalone: true,
  imports: [TranslatePipe, Icon],
  templateUrl: './photo-previews.html',
  styleUrl: './photo-previews.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoPreviews {
  readonly files = input<File[]>([]);
  readonly links = input<string[]>([]);

  readonly dropFile = output<number>();
  readonly dropLink = output<number>();

  /** Nhung duong dan khong tai duoc, de hien bieu tuong thay cho anh vo. */
  readonly broken = signal<ReadonlySet<string>>(new Set());

  private made = new Map<File, string>();

  /** Dia chi tam cua tung tep; tep nao da bi bo thi tra dia chi lai ngay. */
  private readonly fileSources = computed(() => {
    const next = new Map<File, string>();
    for (const file of this.files()) {
      next.set(file, this.made.get(file) ?? URL.createObjectURL(file));
    }
    for (const [file, address] of this.made) {
      if (!next.has(file)) {
        URL.revokeObjectURL(address);
      }
    }
    this.made = next;
    return next;
  });

  readonly tiles = computed<Tile[]>(() => {
    const sources = this.fileSources();
    return [
      ...this.links().map((link, at): Tile => ({ key: 'link:' + link, src: link, from: 'LINK', at })),
      ...this.files().map((file, at): Tile => ({
        key: `file:${file.name}:${file.size}:${at}`,
        src: sources.get(file) ?? '',
        from: 'FILE',
        at,
      })),
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const address of this.made.values()) {
        URL.revokeObjectURL(address);
      }
    });
  }

  markBroken(key: string): void {
    this.broken.update((now) => new Set(now).add(key));
  }

  drop(tile: Tile): void {
    if (tile.from === 'FILE') {
      this.dropFile.emit(tile.at);
    } else {
      this.dropLink.emit(tile.at);
    }
  }
}
