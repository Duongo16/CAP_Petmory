import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { Pet } from '../../core/models/api.model';
import { PetsService } from '../../core/services/pets.service';
import { PhotosService } from '../../core/services/photos.service';
import { PetFaceService } from '../../core/services/pet-face.service';
import { Icon } from '../../shared/icon/icon';
import { genderKeyOf, kindKeyOf } from '../../shared/pet-labels';
import { PetFormDialog, PetFormInput, PetFormResult } from './pet-form-dialog';
import { LEFT, PetDetailDialog, PetDetailRequest } from './pet-detail-dialog';
import { PetFace } from '../../shared/pet-face/pet-face';

type ScreenState = 'LOADING' | 'ERROR' | 'EMPTY' | 'HAS_DATA';

@Component({
  selector: 'pm-pets-page',
  standalone: true,
  imports: [PetFace, DatePipe, RouterLink, TranslatePipe, Icon],
  templateUrl: './pets-page.html',
  styleUrl: './pets-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetsPage implements OnInit {
  private readonly service = inject(PetsService);
  private readonly photos = inject(PhotosService);
  private readonly faces = inject(PetFaceService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** The detail popup that is open now, if any. */
  private detailRef: MatDialogRef<PetDetailDialog, string> | null = null;

  readonly list = signal<Pet[]>([]);
  readonly status = signal<ScreenState>('LOADING');
  readonly error = signal<string | null>(null);
  readonly working = signal(false);


  ngOnInit(): void {
    this.reload();
    // The address carries which pet is open, so a link or the back button reopens it.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const open = params.get('open');
      if (open && !this.detailRef) {
        this.openDetail(open);
      } else if (!open && this.detailRef) {
        this.detailRef.close();
      }
    });
  }

  /** Shows one pet's record over the list, by putting it in the address. */
  show(pet: Pet): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { open: pet._id } });
  }

  private openDetail(petId: string): void {
    this.detailRef = this.dialog.open<PetDetailDialog, PetDetailRequest, string>(PetDetailDialog, {
      data: { petId },
      width: 'min(880px, 96vw)',
      maxHeight: '92vh',
      panelClass: ['pm-dialog', 'pm-dialog-wide'],
      ariaLabelledBy: 'pet-detail-name',
      autoFocus: 'dialog',
    });
    this.detailRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((why) => {
        this.detailRef = null;
        if (why !== LEFT && this.route.snapshot.queryParamMap.has('open')) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { open: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      });
  }

  reload(): void {
    this.status.set('LOADING');
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.list.set(rows);
          this.status.set(rows.length === 0 ? 'EMPTY' : 'HAS_DATA');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  /** Opens the form with nothing filled in, to add a profile. */
  add(): void {
    this.openForm(null);
  }

  /** Opens the same form filled in, to change a profile. */
  edit(pet: Pet): void {
    this.openForm(pet);
  }

  hide(pet: Pet): void {
    this.service
      .hide(pet._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.list.update((rows) => rows.filter((x) => x._id !== pet._id));
          if (this.list().length === 0) {
            this.status.set('EMPTY');
          }
        },
        error: () => this.error.set('COMMON.GENERIC_ERROR'),
      });
  }

  labelKind(pet: Pet): string {
    return kindKeyOf(pet.kind);
  }

  labelGender(pet: Pet): string {
    return genderKeyOf(pet.gender);
  }

  labelStatus(pet: Pet): string {
    return pet.status === 'PASSED_AWAY' ? 'PET.PASSED_AWAY' : 'PET.TOGETHER';
  }

  private openForm(pet: Pet | null): void {
    const input: PetFormInput = { pet };
    this.dialog
      .open<PetFormDialog, PetFormInput, PetFormResult | undefined>(PetFormDialog, {
        data: input,
        width: 'min(640px, 96vw)',
        maxHeight: '94vh',
        panelClass: 'pm-dialog',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.save(pet, result);
        }
      });
  }

  private save(pet: Pet | null, result: PetFormResult): void {
    this.working.set(true);
    this.error.set(null);

    // Ngay de trong phai gui di dang khong co, neu gui chuoi rong thi may chu
    // coi do la mot ngay khong hop le.
    const body = {
      ...result.values,
      birthDate: result.values.birthDate || undefined,
      passedAwayDate: result.values.passedAwayDate || undefined,
      adoptionDate: result.values.adoptionDate || undefined,
    };

    const saved: Observable<Pet> = pet
      ? this.service.update(pet._id, body)
      : this.service.create(body);

    saved
      .pipe(
        switchMap((row) =>
          this.sendPhotos(row, result.photos, result.photoLinks).pipe(map(() => row)),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (row) => {
          this.working.set(false);
          // New photos may have changed which picture stands for this pet.
          this.faces.refresh(row._id);
          this.reload();
        },
        error: (failure: { status?: number }) => {
          this.working.set(false);
          this.error.set(
            failure.status === 403 ? 'PET.QUOTA_REACHED' : 'COMMON.GENERIC_ERROR',
          );
        },
      });
  }

  /**
   * Sends the chosen pictures, whether they came off the owner's machine or from
   * a link they pasted. A pasted link is fetched by the server, not the browser.
   */
  private sendPhotos(pet: Pet, files: File[], links: string[]): Observable<unknown> {
    const sending: Observable<unknown>[] = [
      ...files.map((file) => this.photos.loadGeneral(pet._id, file)),
      ...links.map((link) => this.photos.loadByLink(pet._id, link)),
    ];
    return sending.length === 0 ? of(pet) : forkJoin(sending);
  }
}
