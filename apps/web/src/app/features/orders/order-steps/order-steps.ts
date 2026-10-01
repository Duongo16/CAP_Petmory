import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** One stop of the ordering journey, drawn as a numbered circle with a name. */
interface Stop {
  number: number;
  key: string;
}

const STOPS: Stop[] = [
  { number: 1, key: 'CHECKOUT.STEP_DELIVERY' },
  { number: 2, key: 'CHECKOUT.STEP_PAYMENT' },
  { number: 3, key: 'CHECKOUT.STEP_DONE' },
];

/**
 * How far the joining line is drawn, as a percentage. The line runs from the
 * middle of the first circle to the middle of the last, so each stop passed
 * fills one whole segment and the amber always stops on a circle.
 */
const FILL_BY_STEP: Record<number, number> = { 1: 0, 2: 50, 3: 100 };

/**
 * The three stops shown above every ordering screen, so a customer always
 * knows how far along they are.
 */
@Component({
  selector: 'pm-order-steps',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './order-steps.html',
  styleUrl: './order-steps.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderSteps {
  /** Which stop the customer is on, counted from one. */
  readonly active = input.required<number>();

  readonly stops = STOPS;
  readonly fill = computed(() => FILL_BY_STEP[this.active()] ?? 0);
}
