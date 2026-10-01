import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type BrandSize = 'sm' | 'md' | 'lg';

const MARK_PX: Record<BrandSize, number> = { sm: 34, md: 40, lg: 56 };
const WORD_PX: Record<BrandSize, number> = { sm: 22, md: 26, lg: 38 };

/** The Petmory logo: the hugging dog and cat, then the hand-lettered name. */
@Component({
  selector: 'pm-brand',
  standalone: true,
  templateUrl: './brand.html',
  styleUrl: './brand.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Brand {
  readonly size = input<BrandSize>('md');
  /** Leave the lettering out where only the picture fits. */
  readonly markOnly = input(false);

  readonly markPx = computed(() => MARK_PX[this.size()]);
  readonly wordPx = computed(() => WORD_PX[this.size()]);
  readonly wordWidth = computed(() => Math.round((this.wordPx() * 838) / 245));
}
