import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { DecorItem, Memory } from '../../../core/models/api.model';
import { PaperKind, stickerOf } from '../../../shared/diary-art';

/** Mot to giay trong quyen so: bia, mot khoanh khac, hoac trang trong. */
export type FaceKind = 'COVER' | 'MOMENT' | 'BLANK' | 'END';

/** Mot mat giay da doc xong, san sang ve ra. */
export interface PageFace {
  kind: FaceKind;
  /** So trang hien o goc, dem tu mot. Bia va trang cuoi khong dem. */
  number: number;
  moment: Memory | null;
  paper: PaperKind;
  /** Ten be, chi dung cho bia. */
  petName: string;
  tagline: string;
  avatarUrl: string;
  momentCount: number;
}

/** Mot mon do da tinh xong cho khuon mau ve ra. */
interface DrawnItem {
  raw: DecorItem;
  source: string;
  path: string;
}

/**
 * Ve mot mat giay cua quyen so.
 *
 * Trang co bay tri rieng thi ve dung nhu chu da dat. Trang chua bay tri gi
 * van ve duoc, theo loi mac dinh: tieu de, ngay thang, loi ke va anh xep
 * hang, vi bay tri la lop them vao chu khong phai dieu kien de doc.
 */
@Component({
  selector: 'pm-page-face',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './page-face.html',
  styleUrl: './page-face.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageFaceView {
  readonly face = input.required<PageFace>();

  /** Dia chi xem duoc cua tung buc anh, tra theo ma anh. */
  readonly sourceOf = input.required<Record<string, string>>();

  readonly paperClass = computed(() => `paper-${this.face().paper.toLowerCase()}`);

  /** Cac mon do da bay tri tren trang, xep theo thu tu chong len nhau. */
  readonly items = computed<DrawnItem[]>(() => {
    const seen = this.sourceOf();
    return [...(this.face().moment?.decor ?? [])]
      .sort((a, b) => a.z - b.z)
      .map((raw) => ({
        raw,
        source: raw.photo ? (seen[raw.photo] ?? '') : '',
        path: raw.sticker ? (stickerOf(raw.sticker)?.path ?? '') : '',
      }));
  });

  /** Trang nay da duoc bay tri rieng hay chua. */
  readonly decorated = computed(() => this.items().length > 0);

  /** Cac buc anh gan vao khoanh khac, dung cho trang chua bay tri. */
  readonly plainShots = computed(() => {
    const seen = this.sourceOf();
    return (this.face().moment?.photo ?? [])
      .map((id) => seen[id])
      .filter((one): one is string => Boolean(one));
  });
}
