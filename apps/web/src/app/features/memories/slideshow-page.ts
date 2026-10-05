import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { MemoriesService } from '../../core/services/memories.service';
import { PetsService } from '../../core/services/pets.service';
import { PhotosService } from '../../core/services/photos.service';
import { Memory, MusicTrack, Pet } from '../../core/models/api.model';
import { SlideEffect, SlideSetting, Slideshow } from './slideshow/slideshow';
import { Icon } from '../../shared/icon/icon';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

/**
 * Trinh chieu quyen nhat ky cua chinh chu.
 *
 * Khac ban cong khai o cho anh duoc lay qua duong co kiem quyen, vi quyen co
 * the dang de rieng tu, va o cho chu duoc doi cach trinh chieu.
 */
@Component({
  selector: 'pm-slideshow-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe, Slideshow, Icon],
  templateUrl: './slideshow-page.html',
  styleUrl: './slideshow-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideshowPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(MemoriesService);
  private readonly pets = inject(PetsService);
  private readonly photos = inject(PhotosService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly pet = signal<Pet | null>(null);
  readonly moments = signal<Memory[]>([]);
  readonly tracks = signal<MusicTrack[]>([]);
  readonly sourceOf = signal<Record<string, string>>({});

  private petId = '';

  private readonly cleanup = this.destroyRef.onDestroy(() => this.release());

  readonly setting = computed<SlideSetting>(() => {
    const kept = this.pet()?.slideSetting;
    return {
      trackCode: kept?.trackCode ?? '',
      effect: (kept?.effect ?? 'FADE') as SlideEffect,
      seconds: kept?.seconds ?? 5,
    };
  });

  ngOnInit(): void {
    this.petId = this.route.snapshot.paramMap.get('id') ?? '';
    forkJoin({
      pet: this.pets.byId(this.petId),
      diary: this.service.allForPet(this.petId),
      music: this.service.music(),
      photos: this.photos.list(this.petId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (all) => {
          this.pet.set(all.pet);
          this.moments.set(all.diary);
          this.tracks.set(all.music);
          this.status.set('DONE');
          this.loadShots(all.photos.filter((one) => !one.isRestored).map((one) => one._id));
        },
        error: () => this.status.set('ERROR'),
      });
  }

  /** Doi cach trinh chieu va luu ngay, de mo lai van dung nhu vay. */
  keepSetting(wanted: Partial<SlideSetting>): void {
    this.service
      .setSlide(this.petId, wanted)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (fresh) => this.pet.set(fresh), error: () => undefined });
  }

  /** Doc bytes cua tung buc anh qua duong co kiem quyen. */
  private loadShots(ids: string[]): void {
    if (ids.length === 0) {
      return;
    }
    forkJoin(ids.map((id) => this.photos.content(id)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blobs) => {
          this.release();
          const out: Record<string, string> = {};
          ids.forEach((id, at) => {
            out[id] = URL.createObjectURL(blobs[at]);
          });
          this.sourceOf.set(out);
        },
        error: () => undefined,
      });
  }

  private release(): void {
    for (const where of Object.values(this.sourceOf())) {
      URL.revokeObjectURL(where);
    }
  }
}
