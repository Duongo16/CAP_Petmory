import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { Gender, Pet, PetKind } from '../models/api.model';
import { CreatePetInput, PetsService } from './pets.service';
import { PhotosService } from './photos.service';

/** What a visitor told us about their pet before they had an account. */
export interface PetDraft {
  name: string;
  kind: PetKind;
  breed: string;
  gender: Gender;
  birthDate: string;
  tagline: string;
}

const STORAGE_KEY = 'pm.pet-draft';
const PHOTO_DB = 'pm-pet-draft';
const PHOTO_STORE = 'photo';
const PHOTO_KEY = 'current';

/**
 * Holds the pet profile a visitor starts before signing up, and turns it into a
 * real pet once they are signed in.
 *
 * The draft lives in this browser only. It holds nothing secret, just what the
 * visitor typed and the picture they chose, so keeping it across a reload is a
 * convenience and losing it costs nothing more than doing it again. The text
 * sits in local storage, the picture in IndexedDB, which can hold a whole file.
 */
@Injectable({ providedIn: 'root' })
export class PetDraftService {
  private readonly pets = inject(PetsService);
  private readonly photos = inject(PhotosService);

  readonly draft = signal<PetDraft | null>(readStored());
  readonly photo = signal<File | null>(null);

  constructor() {
    void readPhoto().then((file) => {
      if (file && !this.photo()) {
        this.photo.set(file);
      }
    });
  }

  save(draft: PetDraft): void {
    this.draft.set(draft);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Private browsing can refuse storage, and the draft still lives for this visit.
    }
  }

  setPhoto(file: File | null): void {
    this.photo.set(file);
    void writePhoto(file);
  }

  clear(): void {
    this.draft.set(null);
    this.setPhoto(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing was stored, so there is nothing to remove.
    }
  }

  /**
   * Creates the drafted pet, and its picture, for the account that just signed in.
   *
   * Without a draft this does nothing. A failure never undoes the sign-in: when
   * the pet itself cannot be made the draft is kept so the next sign-in tries
   * again, and a picture that is refused only leaves the album empty.
   */
  claim(): Observable<Pet | null> {
    const draft = this.draft();
    if (!draft || draft.name.trim().length === 0) {
      return of(null);
    }
    const photo = this.photo();
    return this.pets.create(toInput(draft)).pipe(
      switchMap((pet) =>
        photo
          ? this.photos.loadGeneral(pet._id, photo).pipe(
              map(() => pet),
              catchError(() => of(pet)),
            )
          : of(pet),
      ),
      tap(() => this.clear()),
      catchError(() => of(null)),
    );
  }
}

function toInput(draft: PetDraft): CreatePetInput {
  const input: CreatePetInput = { name: draft.name.trim(), kind: draft.kind, gender: draft.gender };
  if (draft.breed.trim()) {
    input.breed = draft.breed.trim();
  }
  if (draft.birthDate) {
    input.birthDate = draft.birthDate;
  }
  if (draft.tagline.trim()) {
    input.tagline = draft.tagline.trim();
  }
  return input;
}

function readStored(): PetDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const value = JSON.parse(raw) as Partial<PetDraft>;
    if (typeof value.name !== 'string' || value.name.trim().length === 0) {
      return null;
    }
    return {
      name: value.name,
      kind: value.kind ?? 'OTHER',
      breed: value.breed ?? '',
      gender: value.gender ?? 'UNKNOWN',
      birthDate: value.birthDate ?? '',
      tagline: value.tagline ?? '',
    };
  } catch {
    return null;
  }
}

function openPhotoDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(PHOTO_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(PHOTO_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readPhoto(): Promise<File | null> {
  const db = await openPhotoDb();
  if (!db) {
    return null;
  }
  return new Promise((resolve) => {
    try {
      const request = db.transaction(PHOTO_STORE, 'readonly').objectStore(PHOTO_STORE).get(PHOTO_KEY);
      request.onsuccess = () => resolve(request.result instanceof File ? request.result : null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writePhoto(file: File | null): Promise<void> {
  const db = await openPhotoDb();
  if (!db) {
    return;
  }
  try {
    const store = db.transaction(PHOTO_STORE, 'readwrite').objectStore(PHOTO_STORE);
    if (file) {
      store.put(file, PHOTO_KEY);
    } else {
      store.delete(PHOTO_KEY);
    }
  } catch {
    // A browser that refuses storage keeps the picture for this visit only.
  }
}
