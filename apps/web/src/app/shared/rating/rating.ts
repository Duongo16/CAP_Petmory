import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** One star in the row, with how full it should be drawn. */
interface StarSlot {
  index: number;
  /** 'full', 'half' or 'empty'. Kept as a word so no colour sits in the view. */
  fill: string;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * A row of five stars.
 *
 * Read only by default. Setting it interactive turns each star into a button,
 * which is how a customer leaves a rating on a delivered order.
 */
@Component({
  selector: 'pm-rating',
  standalone: true,
  templateUrl: './rating.html',
  styleUrl: './rating.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rating {
  readonly value = input(0);
  readonly count = input<number | null>(null);
  readonly interactive = input(false);
  readonly size = input(16);
  /** Accessible name for the whole row, since stars carry no text. */
  readonly label = input('');

  readonly chosen = output<number>();

  /** Precomputes how each star is drawn so the view calls no functions. */
  readonly slots = computed<StarSlot[]>(() => {
    const value = this.value();
    return STARS.map((index) => {
      if (value >= index) {
        return { index, fill: 'full' };
      }
      return { index, fill: value >= index - 0.5 ? 'half' : 'empty' };
    });
  });

  readonly rounded = computed(() => Math.round(this.value() * 10) / 10);

  pick(index: number): void {
    if (this.interactive()) {
      this.chosen.emit(index);
    }
  }
}
