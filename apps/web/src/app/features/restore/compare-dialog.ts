import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Pet, PetPhoto, QualityLabel } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';

/** What the dialog is opened with. */
export interface CompareInput {
  original: PetPhoto;
  restored: PetPhoto;
  beforeUrl: string;
  afterUrl: string;
  pets: Pet[];
}

/** What the dialog hands back when it closes. */
export type CompareResult =
  | { action: 'ATTACH'; pet: string }
  | { action: 'DISCARD' }
  | null;

/** The label for each quality verdict, written out so every key stays searchable. */
const LABEL_QUALITY: Record<QualityLabel, string> = {
  GOOD: 'PHOTO.LABEL.GOOD',
  ACCEPTABLE: 'PHOTO.LABEL.ACCEPTABLE',
  SHOULD_RESTORE: 'PHOTO.LABEL.SHOULD_RESTORE',
  UNUSABLE: 'PHOTO.LABEL.UNUSABLE',
};

/** The two ways of laying the pictures out. */
type Layout = 'SLIDER' | 'SIDE';

@Component({
  selector: 'pm-compare-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, Icon],
  templateUrl: './compare-dialog.html',
  styleUrl: './compare-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareDialog {
  private readonly ref = inject<MatDialogRef<CompareDialog, CompareResult>>(MatDialogRef);
  readonly data = inject<CompareInput>(MAT_DIALOG_DATA);

  /** Where the divider sits, as a percentage from the left. */
  readonly split = signal(50);

  readonly layout = signal<Layout>('SLIDER');

  /** Which pet the reader picked in the box, empty until they choose. */
  readonly chosenPet = signal('');

  /** The name the saved file takes. */
  readonly fileName = computed(() => `petmory-phuc-hoi-${this.data.restored._id}.png`);

  readonly sizeBefore = computed(() => sizeOf(this.data.original));
  readonly sizeAfter = computed(() => sizeOf(this.data.restored));

  /**
   * How many more pixels the cleaned up version carries.
   *
   * A reading of sharpness is deliberately not shown. Sharpness is measured as
   * the variance of a Laplacian filter, and noise counts towards that variance,
   * so taking noise out always lowers the reading even when the picture plainly
   * looks better. Putting a fall in sharpness on screen would tell the reader
   * the opposite of what happened.
   */
  readonly biggerBy = computed(() => {
    const before = this.data.original.quality.width * this.data.original.quality.height;
    const after = this.data.restored.quality.width * this.data.restored.quality.height;
    if (!before) {
      return '—';
    }
    return `${(after / before).toFixed(1)}×`;
  });

  readonly labelBefore = computed(() => LABEL_QUALITY[this.data.original.quality.label]);
  readonly labelAfter = computed(() => LABEL_QUALITY[this.data.restored.quality.label]);

  setSplit(value: string): void {
    this.split.set(Number(value));
  }

  setLayout(value: Layout): void {
    this.layout.set(value);
  }

  setPet(value: string): void {
    this.chosenPet.set(value);
  }

  attach(): void {
    const pet = this.chosenPet();
    if (!pet) {
      return;
    }
    this.ref.close({ action: 'ATTACH', pet });
  }

  discard(): void {
    this.ref.close({ action: 'DISCARD' });
  }

  close(): void {
    this.ref.close(null);
  }
}

function sizeOf(photo: PetPhoto): string {
  return `${photo.quality.width} × ${photo.quality.height}`;
}
