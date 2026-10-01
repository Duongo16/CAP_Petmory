import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { PhotoTile, PhotosFacade } from './photos-facade';
import { PhotoEditDialog, PhotoEditRequest } from './photo-edit-dialog';

/**
 * The four stops of the journey shown beside the album, so an owner can see
 * where sending photographs sits in the making of a keepsake.
 */
const JOURNEY: string[] = [
  'PHOTO.JOURNEY.PICK',
  'PHOTO.JOURNEY.COLOURS',
  'PHOTO.JOURNEY.CRAFT',
  'PHOTO.JOURNEY.HAND_OVER',
];
import { Icon } from '../../shared/icon/icon';
import { ImageLink } from '../../shared/image-link/image-link';

@Component({
  selector: 'pm-photos-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe, Icon, ImageLink],
  providers: [PhotosFacade],
  templateUrl: './photos-page.html',
  styleUrl: './photos-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotosPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  readonly facade = inject(PhotosFacade);

  readonly journey = JOURNEY;

  ngOnInit(): void {
    this.facade.start(this.route.snapshot.paramMap.get('id') ?? '');
  }

  /**
   * Mo hop sua anh cho tung buc vua chon, roi moi gui len.
   *
   * Xoay va cat deu lam trong hop nay, tuc la truoc khi anh roi may. Anh da
   * nam trong album thi khong di qua day nua: sua mot buc da dung cho don
   * hang se lam sai ho so san xuat.
   */
  pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    // Xoa lua chon cu, de chon lai dung tep do van kich hoat su kien.
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
          this.facade.add(ready);
        }
      });
  }

  remove(tile: PhotoTile): void {
    this.facade.remove(tile.photo);
  }
}
