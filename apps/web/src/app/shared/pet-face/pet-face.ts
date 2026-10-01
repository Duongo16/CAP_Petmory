import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { PetFaceService } from '../../core/services/pet-face.service';
import { PetArt, PetArtKind } from '../pet-art/pet-art';

/**
 * A pet's face, the same everywhere: its avatar, else its best album photo,
 * else a drawing of its kind.
 */
@Component({
  selector: 'pm-pet-face',
  standalone: true,
  imports: [PetArt],
  template: `
    <span
      class="face"
      [class.round]="round()"
      [class.fill]="fill()"
      [style.width.px]="fill() ? null : size()"
      [style.height.px]="fill() ? null : size()"
    >
      @if (source(); as src) {
        <img [src]="src" [alt]="name()" />
      } @else {
        <pm-pet-art [kind]="art()" [face]="true" [width]="artWidth()" />
      }
    </span>
  `,
  styleUrl: './pet-face.scss',
  host: { '[class.fill]': 'fill()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetFace {
  private readonly faces = inject(PetFaceService);

  readonly petId = input.required<string>();
  readonly avatarUrl = input<string | null | undefined>('');
  readonly kind = input<string>('OTHER');
  readonly name = input('');
  readonly size = input(56);
  readonly round = input(false);
  /** Phu kin khung cha thay vi giu mot co co dinh. */
  readonly fill = input(false);
  /** Off for someone else's pet, whose album this person may not read. */
  readonly album = input(true);

  readonly art = computed<PetArtKind>(() => (this.kind() === 'CAT' ? 'cat' : 'dog'));
  readonly artWidth = computed(() => Math.round(this.size() * (this.fill() ? 1 : 0.78)));

  readonly source = computed(
    () => this.avatarUrl() || (this.album() ? this.faces.faces()[this.petId()] : '') || '',
  );

  protected readonly askAlbum = effect(() => {
    if (!this.avatarUrl() && this.album()) {
      this.faces.request(this.petId());
    }
  });
}
