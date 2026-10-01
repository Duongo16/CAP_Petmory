import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';

/** One stop on the bar, with its wording written out in full. */
interface Stop {
  path: string;
  key: string;
  icon: string;
}

const STOPS: Stop[] = [
  { path: '/home', key: 'NAV.HOME', icon: 'home' },
  { path: '/pets', key: 'NAV.PET_SHORT', icon: 'paw' },
  { path: '/journals', key: 'NAV.JOURNALS', icon: 'book' },
  { path: '/shop', key: 'NAV.SHOP', icon: 'cart' },
  { path: '/orders', key: 'NAV.ORDER', icon: 'bookmark' },
];

/**
 * The bar of destinations along the bottom of a phone screen.
 *
 * It only appears on narrow screens; on a wide one the bar at the top of the
 * page already carries the same destinations, so this would be a second copy.
 */
@Component({
  selector: 'pm-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, Icon],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomNav {
  readonly stops = STOPS;
}
