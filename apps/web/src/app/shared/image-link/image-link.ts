import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** Duong dan phai la http hay https va tro toi mot dia chi co thuc. */
const LINK_SHAPE = /^https?:\/\/[^\s/]+\.[^\s/]+\/?\S*$/i;

/**
 * O dan duong dan mot buc anh tren mang.
 *
 * Dung canh cho chon tep, cho nhung ai da co san anh o dau do tren mang va
 * khong muon tai ve may roi tai len lai. O nay chi lo phan kiem tra hinh dang
 * duong dan; noi dung anh do may chu tai ve va kiem lai.
 */
@Component({
  selector: 'pm-image-link',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './image-link.html',
  styleUrl: './image-link.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageLink {
  /** Ma dinh danh rieng, de nhan chu va o nhap dinh dung nhau. */
  readonly boxId = input('image-link');
  readonly disabled = input(false);
  readonly busy = input(false);

  /** Duong dan da qua kiem tra hinh dang. */
  readonly picked = output<string>();

  readonly typed = signal('');
  readonly wrong = signal(false);

  readonly ready = computed(() => this.typed().trim().length > 0 && !this.disabled());

  write(value: string): void {
    this.typed.set(value);
    this.wrong.set(false);
  }

  add(): void {
    const link = this.typed().trim();
    if (!LINK_SHAPE.test(link)) {
      this.wrong.set(true);
      return;
    }
    this.picked.emit(link);
    this.typed.set('');
    this.wrong.set(false);
  }
}
