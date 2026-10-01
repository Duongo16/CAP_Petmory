import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';
import { PhotosService } from './photos.service';

/**
 * The one place that decides which picture stands for a pet, so every screen
 * shows the same face.
 *
 * A pet's own avatar comes first. Without one, the album is asked for the
 * front-facing photo, then for any photo that is not a restored copy. Album
 * photos sit behind the owner check, so they are read once, turned into a local
 * address and remembered for the rest of the session.
 */
@Injectable({ providedIn: 'root' })
export class PetFaceService {
  private readonly photos = inject(PhotosService);
  private readonly auth = inject(AuthService);

  /** Local addresses of album faces, by pet. An empty string means the album has none. */
  readonly faces = signal<Record<string, string>>({});

  private readonly asked = new Set<string>();

  private signedInAs: string | null = this.auth.user()?.id ?? null;

  /**
   * A different person signing in must not see the previous person's pictures.
   * Only the signed-in id is watched; the clean-up runs untracked, otherwise
   * every face that arrives would wipe the store and start the reads again.
   */
  protected readonly forgetOnSignOut = effect(() => {
    const who = this.auth.user()?.id ?? null;
    untracked(() => {
      if (who !== this.signedInAs) {
        this.signedInAs = who;
        this.forget();
      }
    });
  });

  /** Starts reading a pet's album face, once per session. */
  request(petId: string): void {
    if (!petId || this.asked.has(petId)) {
      return;
    }
    this.asked.add(petId);
    this.photos
      .list(petId)
      .pipe(
        switchMap((album) => {
          const kept = album.filter((one) => !one.isRestored);
          const pick = kept.find((one) => one.angle === 'FRONT') ?? kept[0];
          return pick ? this.photos.content(pick._id).pipe(map((blob) => URL.createObjectURL(blob))) : of('');
        }),
        catchError(() => of('')),
      )
      .subscribe((address) => this.faces.update((now) => ({ ...now, [petId]: address })));
  }

  /** Reads a pet's album again, after its photos changed. */
  refresh(petId: string): void {
    const old = this.faces()[petId];
    if (old) {
      URL.revokeObjectURL(old);
    }
    this.asked.delete(petId);
    this.faces.update((now) => {
      const next = { ...now };
      delete next[petId];
      return next;
    });
    this.request(petId);
  }

  private forget(): void {
    for (const address of Object.values(this.faces())) {
      if (address) {
        URL.revokeObjectURL(address);
      }
    }
    this.asked.clear();
    this.faces.set({});
  }
}
