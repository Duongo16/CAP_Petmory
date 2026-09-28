import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SOCIAL_LINKS } from '../../core/social-links';

/**
 * The outward contact buttons. PETMORY does not run its own inbox, so anyone
 * wanting to talk to a person is handed over to a channel the shop already uses.
 */
@Component({
  selector: 'pm-social-links',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './social-links.html',
  styleUrl: './social-links.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialLinks {
  /** 'compact' shows only the round badges, 'full' adds the channel name. */
  readonly variant = input<'compact' | 'full'>('compact');

  readonly links = SOCIAL_LINKS;
}
