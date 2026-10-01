import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import { PostDetailPage } from './post-detail-page';

/** Which post to open, and whether to go straight to the comment box. */
export interface PostDetailRequest {
  id: string;
  comment: boolean;
}

/** One post with its comments, opened over the feed instead of on a page of its own. */
@Component({
  selector: 'pm-post-detail-dialog',
  standalone: true,
  imports: [TranslatePipe, Icon, PostDetailPage],
  templateUrl: './post-detail-dialog.html',
  styleUrl: './post-detail-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostDetailDialog {
  readonly data = inject<PostDetailRequest>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<PostDetailDialog>);

  close(): void {
    this.ref.close();
  }
}
