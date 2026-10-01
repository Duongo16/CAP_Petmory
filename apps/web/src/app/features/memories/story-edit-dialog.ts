import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';

/** Hop thoai duoc mo voi cau chuyen nao. */
export interface StoryEditInput {
  title: string;
  content: string;
}

/** Hop thoai tra lai gi. Trang goi moi la noi gui len may chu. */
export interface StoryEditResult {
  title: string;
  content: string;
}

/**
 * Hop thoai sua mot cau chuyen.
 *
 * Truoc day bieu mau nay thay cho phan dang doc, nen nguoi dung mat luon ban
 * goc khi sua. Dua vao hop thoai thi ban goc van nam do phia sau.
 */
@Component({
  selector: 'pm-story-edit-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, Icon],
  templateUrl: './story-edit-dialog.html',
  styleUrl: './story-edit-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryEditDialog {
  private readonly ref = inject<MatDialogRef<StoryEditDialog, StoryEditResult>>(MatDialogRef);
  private readonly data = inject<StoryEditInput>(MAT_DIALOG_DATA);

  readonly title = signal(this.data.title);
  readonly content = signal(this.data.content);

  readonly canSave = computed(
    () => this.title().trim().length > 0 && this.content().trim().length > 0,
  );

  save(): void {
    if (!this.canSave()) {
      return;
    }
    this.ref.close({ title: this.title().trim(), content: this.content().trim() });
  }

  close(): void {
    this.ref.close(undefined);
  }
}
