import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The welcome illustration: an open diary with the pets it remembers floating
 * up out of its pages, framed like photographs. Drawn as one inline picture so
 * it takes the theme colours and moves without any image to download.
 */
@Component({
  selector: 'pm-diary-scene',
  standalone: true,
  templateUrl: './diary-scene.html',
  styleUrl: './diary-scene.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiaryScene {
  readonly width = input(520);
  /** On a coloured panel the halo and trails switch to light tones. */
  readonly onColor = input(false);
}
