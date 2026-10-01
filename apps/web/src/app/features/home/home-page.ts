import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { CatalogService } from '../../core/services/catalog.service';
import { ProductType } from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';
import { Icon } from '../../shared/icon/icon';

/**
 * A selling point under the hero. Both keys are written out in full, because a
 * key built by joining strings cannot be found by searching the source.
 */
interface SellingPoint {
  icon: string;
  nameKey: string;
  textKey: string;
}

/** One numbered step in the process strip, with its keys written out the same way. */
interface ProcessStep {
  number: string;
  tone: string;
  nameKey: string;
  textKey: string;
}

/** One quote in the stories strip. */
interface Story {
  textKey: string;
  nameKey: string;
  placeKey: string;
}

const FEATURED_MAX = 4;

/** The badge each featured card carries, in the order the cards appear. */
const BADGE_TONE = ['amber', 'green', 'purple', 'plain'] as const;

@Component({
  selector: 'pm-home-page',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslatePipe, MoneyPipe, Icon],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly products = signal<ProductType[]>([]);

  /** The first few products, shown as a taster under the selling points. */
  readonly featured = computed(() =>
    this.products()
      .slice(0, FEATURED_MAX)
      .map((raw, index) => ({
        raw,
        priceFrom: lowestPrice(raw),
        tone: BADGE_TONE[index] ?? 'plain',
      })),
  );

  /** What the reader typed into the newsletter box. */
  readonly email = signal('');

  /** Turns true once the box has been submitted, so the form can say thank you. */
  readonly subscribed = signal(false);

  readonly points: SellingPoint[] = [
    { icon: 'image', nameKey: 'HOME.POINT.UPLOAD.NAME', textKey: 'HOME.POINT.UPLOAD.OVERLAY' },
    { icon: 'star', nameKey: 'HOME.POINT.PERSONALISED.NAME', textKey: 'HOME.POINT.PERSONALISED.OVERLAY' },
    { icon: 'paw', nameKey: 'HOME.POINT.HANDMADE.NAME', textKey: 'HOME.POINT.HANDMADE.OVERLAY' },
    { icon: 'cart', nameKey: 'HOME.POINT.DELIVERY.NAME', textKey: 'HOME.POINT.DELIVERY.OVERLAY' },
  ];

  readonly steps: ProcessStep[] = [
    { number: '01', tone: 'purple', nameKey: 'HOME.STEP.1.NAME', textKey: 'HOME.STEP.1.OVERLAY' },
    { number: '02', tone: 'amber', nameKey: 'HOME.STEP.2.NAME', textKey: 'HOME.STEP.2.OVERLAY' },
    { number: '03', tone: 'green', nameKey: 'HOME.STEP.3.NAME', textKey: 'HOME.STEP.3.OVERLAY' },
    { number: '04', tone: 'soft', nameKey: 'HOME.STEP.4.NAME', textKey: 'HOME.STEP.4.OVERLAY' },
  ];

  readonly stories: Story[] = [
    { textKey: 'HOME.STORY.1.TEXT', nameKey: 'HOME.STORY.1.NAME', placeKey: 'HOME.STORY.1.PLACE' },
    { textKey: 'HOME.STORY.2.TEXT', nameKey: 'HOME.STORY.2.NAME', placeKey: 'HOME.STORY.2.PLACE' },
    { textKey: 'HOME.STORY.3.TEXT', nameKey: 'HOME.STORY.3.NAME', placeKey: 'HOME.STORY.3.PLACE' },
  ];

  ngOnInit(): void {
    this.catalog.product$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.products.set(list),
      error: () => undefined,
    });
  }

  setEmail(value: string): void {
    this.email.set(value);
  }

  subscribe(): void {
    if (this.email().trim().length === 0) {
      return;
    }
    this.subscribed.set(true);
  }
}

/** The cheapest enabled size, compared as whole dong so nothing rounds. */
function lowestPrice(product: ProductType): string | null {
  const price = product.sizes
    .filter((s) => s.enabled)
    .map((s) => BigInt(s.price.$numberDecimal.split('.')[0]));
  if (price.length === 0) {
    return null;
  }
  return price.reduce((a, b) => (a < b ? a : b)).toString();
}
