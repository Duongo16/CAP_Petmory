import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { AngleSlot, PetPhotosFacade, PhotoCard } from './pet-photos-facade';
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

  /** O dang co anh keo ngang qua, de to sang vung tha. */
  readonly dragOver = signal<string | null>(null);

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
    this.editThen(chosen, (ready) => this.facade.add(ready, this.tell));
  }

  /** Chon anh cho mot goc trong khung; goc da co anh thi la thay anh. */
  pickForSlot(event: Event, slot: AngleSlot): void {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []).slice(0, 1);
    input.value = '';
    this.toSlot(chosen, slot);
  }

  hover(event: DragEvent, target: string): void {
    event.preventDefault();
    this.dragOver.set(target);
  }

  leave(target: string): void {
    if (this.dragOver() === target) {
      this.dragOver.set(null);
    }
  }

  /** Tha anh vao mot goc: chi lay tam dau tien. */
  dropOnSlot(event: DragEvent, slot: AngleSlot): void {
    event.preventDefault();
    this.dragOver.set(null);
    this.toSlot(Array.from(event.dataTransfer?.files ?? []).slice(0, 1), slot);
  }

  /** Tha nhieu anh vao phan anh khac. */
  dropOnAlbum(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(null);
    this.editThen(Array.from(event.dataTransfer?.files ?? []), (ready) => this.facade.add(ready, this.tell));
  }

  removeFromSlot(slot: AngleSlot): void {
    if (slot.card) {
      this.facade.remove(slot.card.photo, this.tell);
    }
  }

  private toSlot(files: File[], slot: AngleSlot): void {
    this.editThen(files, (ready) => this.facade.addToAngle(slot.angle, ready[0], slot.card?.photo ?? null, this.tell));
  }

  /** Mo hop cat, xoay anh truoc khi gui; chi gui khi nguoi dung xac nhan. */
  private editThen(chosen: File[], send: (ready: File[]) => void): void {
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
          send(ready);
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
