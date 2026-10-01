import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../../shared/icon/icon';

/** Xem mot tam anh cua be o co lon. */
@Component({
  selector: 'pm-photo-viewer',
  standalone: true,
  imports: [TranslatePipe, Icon],
  template: `
    <figure class="frame">
      <img [src]="source" alt="" />
      <button type="button" class="shut" (click)="close()" [attr.aria-label]="'COMMON.CLOSE' | translate">
        <pm-icon name="close" [size]="18" />
      </button>
    </figure>
  `,
  styleUrl: './photo-viewer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoViewer {
  private readonly ref = inject(MatDialogRef<PhotoViewer>);
  readonly source = inject<string>(MAT_DIALOG_DATA);

  close(): void {
    this.ref.close();
  }
}
