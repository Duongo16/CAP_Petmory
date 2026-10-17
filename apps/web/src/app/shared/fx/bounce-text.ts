import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RevealDirective } from './reveal.directive';

/**
 * Chu nay tung tu khi cuon toi: tach cau thanh tung tu, moi tu bat len noi duoi nhau.
 *
 * Dat ben trong the tieu de (h1, h2) de giu nghia cua tieu de. Trinh doc man hinh
 * doc ca cau mot lan qua nhan an, khong doc roi rac tung tu.
 */
@Component({
  selector: 'pm-bounce-text',
  standalone: true,
  hostDirectives: [RevealDirective],
  template: `
    <span class="sr-only">{{ text() }}</span>
    <span class="words" aria-hidden="true">
      @for (word of words(); track $index) {
        <span class="word" [style.--i]="$index">{{ word }}</span>{{ ' ' }}
      }
    </span>
  `,
  styleUrl: './bounce-text.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BounceText {
  readonly text = input('');

  readonly words = computed(() => this.text().split(/\s+/).filter(Boolean));
}
