import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type PetArtKind = 'cat' | 'dog';

/** A flat drawing of a cat or a dog, used where a photo would only be decoration. */
@Component({
  selector: 'pm-pet-art',
  standalone: true,
  templateUrl: './pet-art.html',
  styleUrl: './pet-art.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetArt {
  readonly kind = input<PetArtKind>('cat');
  readonly width = input(240);
  /** A head-only drawing, small enough for an avatar. */
  readonly face = input(false);
}
