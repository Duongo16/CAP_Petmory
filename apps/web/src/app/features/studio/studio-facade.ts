import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap } from 'rxjs';
import { DesignsService } from '../../core/services/designs.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CartService } from '../../core/services/cart.service';
import { PetsService } from '../../core/services/pets.service';
import {
  Quote,
  PreviewAngle,
  ProductSize,
  ProductType,
  SaveDesign,
  Design,
  MeshPaint,
  Pet,
} from '../../core/models/api.model';

export type SaveState = 'UNSAVED' | 'SAVING' | 'SAVED' | 'ERROR';

/** Converts the data URL the browser produced into a binary blob for upload. */
function dataUrlToBlob(str: string): Blob {
  const part = str.split(',');
  const binary = atob(part[1] ?? '');
  const byte = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    byte[i] = binary.charCodeAt(i);
  }
  return new Blob([byte], { type: 'image/png' });
}

/**
 * Holds the catalog, quoting and draft saving for the customiser screen.
 * The component only deals with the 3D side and makes no server calls itself.
 */
@Injectable()
export class StudioFacade {
  private readonly designs = inject(DesignsService);
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly petsService = inject(PetsService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly types = signal<ProductType[]>([]);
  readonly codeKindSelected = signal('');
  readonly sizeCodeSelected = signal('');
  readonly quote = signal<Quote | null>(null);

  readonly designId = signal<string | null>(null);
  readonly statusSave = signal<SaveState>('UNSAVED');
  readonly error = signal<string | null>(null);
  readonly addedToCart = signal(false);

  /** The saved colours of the open draft, passed to the viewer to be reloaded. */
  readonly paintSaved = signal<MeshPaint[]>([]);
  readonly nameDraft = signal('');

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    petId: [''],
    engravedName: ['', [Validators.maxLength(60)]],
    memorialDate: [''],
    message: ['', [Validators.maxLength(300)]],
  });

  /** The customer's pet profiles, so a design can be tied to one of them. */
  readonly pets = signal<Pet[]>([]);

  readonly kindSelected = computed<ProductType | null>(
    () => this.types().find((l) => l.code === this.codeKindSelected()) ?? null,
  );

  readonly sizes = computed<ProductSize[]>(
    () => this.kindSelected()?.sizes.filter((s) => s.enabled) ?? [],
  );

  readonly chosenProduct = computed(
    () => Boolean(this.codeKindSelected()) && Boolean(this.sizeCodeSelected()),
  );

  readonly canAddToCart = computed(
    () => this.chosenProduct() && this.designId() !== null && !this.addedToCart(),
  );

  /** Loads the pet profiles the design can be tied to. */
  loadPets(): void {
    this.petsService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (list) => this.pets.set(list), error: () => this.pets.set([]) });
  }

  loadCatalog(): void {
    this.catalog.product$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ds) => this.types.set(ds.filter((l) => l.enabled)),
        error: () => this.types.set([]),
      });
  }

  selectKind(code: string): void {
    this.codeKindSelected.set(code);
    this.sizeCodeSelected.set('');
    this.quote.set(null);
    this.addedToCart.set(false);
  }

  selectSize(code: string): void {
    this.sizeCodeSelected.set(code);
    this.addedToCart.set(false);
    this.fetchQuote();
  }

  /** The price is always asked of the server, never taken from the cached catalog. */
  private fetchQuote(): void {
    const kind = this.codeKindSelected();
    const size = this.sizeCodeSelected();
    if (!kind || !size) {
      return;
    }
    this.designs
      .quote(kind, size)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (bg) => this.quote.set(bg),
        error: () => this.quote.set(null),
      });
  }

  /**
   * Saves the draft, then uploads the six preview images.
   * Images go second because a design id is needed before they can be attached.
   */
  save(
    modelCode: string,
    paint: MeshPaint[],
    colorCodesUsed: string[],
    sixAnglePhotos: { angle: PreviewAngle; photo: string }[],
  ): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.statusSave.set('SAVING');
    this.error.set(null);

    const v = this.form.getRawValue();
    const than: SaveDesign = {
      name: v.name.trim(),
      modelCode,
      paint,
      colorCodesUsed,
      productTypeCode: this.codeKindSelected() || undefined,
      sizeCode: this.sizeCodeSelected() || undefined,
      // Tying the design to a pet is what carries the customer's photos through
      // to the production file the workshop reads.
      pet: v.petId || undefined,
      engraving: {
        name: v.engravedName.trim(),
        memorialDate: v.memorialDate || undefined,
        message: v.message.trim(),
      },
    };

    const existing = this.designId();
    const savePrimary = existing ? this.designs.update(existing, than) : this.designs.create(than);

    savePrimary
      .pipe(
        switchMap((tk) => this.sendPhoto(tk, sixAnglePhotos)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (tk) => {
          this.designId.set(tk._id);
          this.nameDraft.set(tk.name);
          this.statusSave.set('SAVED');
        },
        error: () => {
          this.statusSave.set('ERROR');
          this.error.set('STUDIO.ERROR_SAVE');
        },
      });
  }

  private sendPhoto(tk: Design, sixAnglePhotos: { angle: PreviewAngle; photo: string }[]) {
    if (sixAnglePhotos.length === 0) {
      return of(tk);
    }
    const uploads = sixAnglePhotos.map((m) =>
      this.designs.loadPreview(tk._id, m.angle, dataUrlToBlob(m.photo)),
    );
    return forkJoin(uploads).pipe(switchMap((ds) => of(ds[ds.length - 1] ?? tk)));
  }

  addToCart(petName: string): void {
    const code = this.designId();
    if (!code || !this.chosenProduct()) {
      return;
    }
    this.cart
      .add({
        productTypeCode: this.codeKindSelected(),
        sizeCode: this.sizeCodeSelected(),
        quantity: 1,
        designId: code,
        petName: petName || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.addedToCart.set(true),
        error: () => this.error.set('COMMON.GENERIC_ERROR'),
      });
  }

  /** Reopens a saved draft and reports the model code so the screen selects the right model. */
  openDraft(id: string, onDone: (tk: Design) => void): void {
    this.designs
      .detail(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tk) => {
          this.designId.set(tk._id);
          this.nameDraft.set(tk.name);
          this.paintSaved.set(tk.paint);
          this.codeKindSelected.set(tk.productTypeCode);
          this.sizeCodeSelected.set(tk.sizeCode);
          this.form.patchValue({
            name: tk.name,
            engravedName: tk.engraving?.name ?? '',
            memorialDate: tk.engraving?.memorialDate ? tk.engraving.memorialDate.slice(0, 10) : '',
            message: tk.engraving?.message ?? '',
          });
          if (tk.productTypeCode && tk.sizeCode) {
            this.fetchQuote();
          }
          onDone(tk);
        },
        error: () => this.error.set('STUDIO.ERROR_OPEN_DRAFT'),
      });
  }
}
