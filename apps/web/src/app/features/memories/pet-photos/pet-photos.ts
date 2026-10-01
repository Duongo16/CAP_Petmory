import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { PetPhotosFacade, PhotoCard } from './pet-photos-facade';
import { PhotoEditDialog, PhotoEditRequest } from './photo-edit-dialog';
import { PhotoViewer } from './photo-viewer';
import { Icon } from '../../../shared/icon/icon';
import { ImageLink } from '../../../shared/image-link/image-link';

/**
 * Tab Anh trong nhat ky: toan bo anh hien co cua mot be, them tu may hoac tu
 * duong dan, va bo di tam khong muon giu.
 */
@Component({
  selector: 'pm-pet-photos',
  standalone: true,
  imports: [DatePipe, TranslatePipe, Icon, ImageLink],
  providers: [PetPhotosFacade],
  templateUrl: './pet-photos.html',
  styleUrl: './pet-photos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetPhotos implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  readonly facade = inject(PetPhotosFacade);

  readonly petId = input.required<string>();

  /** Bao cho trang nhat ky biet album vua doi, de cap nhat anh dai dien. */
  readonly changed = output<void>();

  private readonly tell = (): void => this.changed.emit();

  ngOnInit(): void {
    this.facade.start(this.petId());
  }

  /**
   * Mo hop sua anh cho tung tam vua chon, roi moi gui len. Xoay va cat deu
   * lam o buoc nay, truoc khi anh roi may.
   */
  pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    input.value = '';
    if (chosen.length === 0) {
      return;
    }
    this.dialog
      .open<PhotoEditDialog, PhotoEditRequest, File[]>(PhotoEditDialog, {
        data: { files: chosen, goodShortEdgePx: this.facade.rules()?.goodShortEdgePx ?? 0 },
        width: 'min(680px, 95vw)',
        maxHeight: '94vh',
        panelClass: 'pm-dialog',
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ready) => {
        if (ready && ready.length > 0) {
          this.facade.add(ready, this.tell);
        }
      });
  }

  addLink(url: string): void {
    this.facade.addLink(url, this.tell);
  }

  remove(card: PhotoCard): void {
    this.facade.remove(card.photo, this.tell);
  }

  /** Mo tam anh o co lon trong mot hop thoai. */
  open(card: PhotoCard): void {
    this.dialog.open<PhotoViewer, string>(PhotoViewer, {
      data: card.source,
      maxWidth: '94vw',
      maxHeight: '94vh',
      panelClass: 'pm-dialog',
    });
  }
}
