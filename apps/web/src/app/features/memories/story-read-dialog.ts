import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { PetStory } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';

/** Cau chuyen can doc, kem ten khoanh khac va ten be de ghi tren dau hop. */
export interface StoryReadRequest {
  story: PetStory;
  momentTitle: string;
  petName: string;
}

/**
 * Doc tron mot cau chuyen da gan vao khoanh khac.
 *
 * The khoanh khac chi hien vai dong dau, nen hop nay cho doc het bai, giu
 * nguyen cac doan xuong dong nhu luc viet.
 */
@Component({
  selector: 'pm-story-read-dialog',
  standalone: true,
  imports: [DatePipe, TranslatePipe, Icon],
  templateUrl: './story-read-dialog.html',
  styleUrl: './story-read-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryReadDialog {
  private readonly ref = inject(MatDialogRef<StoryReadDialog>);
  readonly data = inject<StoryReadRequest>(MAT_DIALOG_DATA);

  /** Cac doan cua bai, tach theo dong trong de moi doan la mot khoi chu. */
  readonly paragraphs = this.data.story.content
    .split(/\n\s*\n|\n/)
    .map((one) => one.trim())
    .filter(Boolean);

  close(): void {
    this.ref.close();
  }
}
