import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap } from 'rxjs';
import { DesignsService } from '../../core/services/designs.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CartService } from '../../core/services/cart.service';
import { PetsService } from '../../core/services/pets.service';
import { PhotosService } from '../../core/services/photos.service';
import { AiService } from '../../core/services/ai.service';
import {
  Quote,
  PreviewAngle,
  ProductSize,
  ProductType,
  SaveDesign,
  Design,
  MeshPaint,
  Pet,
  DisplayBase,
  Accessory,
  PackagingKind,
  PackagingOption,
  PhotoMatchInfo,
} from '../../core/models/api.model';
import {
  BASE_NONE,
  StandDecoration,
  StandTone,
  STAND_DECORATION_MAX,
} from '../../shared/viewer-3d/stand-options';

/** Lua chon de cua ban thiet ke dang mo. */
export interface StandChoice {
  baseCode: string;
  tone: StandTone;
  decorations: StandDecoration[];
}

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
  private readonly photosService = inject(PhotosService);
  private readonly ai = inject(AiService);
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
    featureNote: ['', [Validators.maxLength(500)]],
  });

  /** Trang thai buoc dung san mau tu anh cua be. */
  readonly matching = signal(false);

  /** Nhung gi he thong nhan ra tu anh lan gan nhat; rong khi chua dung mau. */
  readonly match = signal<PhotoMatchInfo | null>(null);

  /** Key loi cua buoc dung mau, rong khi khong co loi. */
  readonly matchError = signal('');

  /** Da chon be va be co it nhat mot anh thi moi dung mau duoc. */
  readonly canMatch = computed(() => Boolean(this.petChosen()) && (this.photoCount() ?? 0) > 0 && !this.matching());

  /**
   * Gui anh cua be cho may chu dung san mot mau gan giong nhat.
   *
   * May chu tao san mot ban thiet ke voi mau nen va mau tung vung; man hinh mo
   * ban do len nhu mo mot ban nhap de khach tuy bien tiep.
   */
  matchFromPhoto(onDesign: (designId: string) => void): void {
    const pet = this.petChosen();
    if (!this.canMatch()) {
      return;
    }
    this.matching.set(true);
    this.matchError.set('');
    this.ai
      .matchFromPhoto(pet)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (got) => {
          this.matching.set(false);
          this.match.set(got.match);
          onDesign(got.design._id);
        },
        error: (trouble: { status?: number }) => {
          this.matching.set(false);
          this.matchError.set(trouble?.status === 429 ? 'STUDIO.MATCH.QUOTA' : 'STUDIO.MATCH.FAILED');
        },
      });
  }

  /** Be dang gan voi ban thiet ke; hang tuy bien lam theo anh cua chinh be nay. */
  readonly petChosen = signal('');

  /** So anh goc cua be dang chon; rong khi chua biet. */
  readonly photoCount = signal<number | null>(null);

  /** So anh toi thieu cua kich co dang chon (muc 7, 12). */
  readonly minPhotos = computed(() => {
    const fromQuote = this.quote()?.minPhotos;
    if (fromQuote !== undefined) {
      return fromQuote;
    }
    return this.sizes().find((one) => one.code === this.sizeCodeSelected())?.minPhotos ?? 0;
  });

  /** Da gan be va be du anh cho kich co nay chua. */
  readonly photosReady = computed(() => {
    const have = this.photoCount();
    return Boolean(this.petChosen()) && have !== null && have >= this.minPhotos();
  });

  /** Dem lai anh cua be dang chon, goi sau khi doi be hoac vua tai them anh. */
  refreshPhotos(): void {
    const pet = this.form.controls.petId.value;
    if (!pet) {
      this.photoCount.set(null);
      return;
    }
    this.photosService
      .list(pet)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => this.photoCount.set(rows.filter((one) => !one.isRestored).length),
        error: () => this.photoCount.set(null),
      });
  }

  /** The customer's pet profiles, so a design can be tied to one of them. */
  readonly pets = signal<Pet[]>([]);

  /** Danh muc de cua cua hang, kem gia, doc tu may chu. */
  readonly bases = signal<DisplayBase[]>([]);

  /** Danh muc phu kien dung chung, kem gia, doc tu may chu. */
  readonly accessoryCatalog = signal<Accessory[]>([]);

  /** Ma phu kien dang gan len mau, moi diem neo mot mon. */
  readonly accessoryPicked = signal<string[]>([]);

  /** So phu kien toi da cua kich co dang chon; chua chon kich co thi theo so diem neo. */
  readonly accessoryMax = computed(() => {
    const size = this.sizes().find((one) => one.code === this.sizeCodeSelected());
    return size ? size.maxAccessories : 4;
  });

  /** Hop va khung dang ban, kem gia, doc tu may chu. */
  readonly packagingCatalog = signal<PackagingOption[]>([]);

  /**
   * Hop va khung khach chon, moi loai mot mau.
   *
   * Mac dinh khong chon gi, de khong tu cong tien vao don. Lua chon nay di theo
   * dong gio hang chu khong luu vao ban thiet ke, nen doi xong khong can luu lai.
   */
  readonly packagingPicked = signal<Partial<Record<PackagingKind, string>>>({});

  /** Ma hop va khung dang chon, de gui di bao gia va them vao gio. */
  readonly packagingCodes = computed(() => Object.values(this.packagingPicked()).filter((one): one is string => Boolean(one)));

  /** Mac dinh khong de, de khong tu cong tien vao don cua khach. */
  readonly stand = signal<StandChoice>({ baseCode: BASE_NONE, tone: 'OAK', decorations: [] });

  /**
   * Da doi de sau lan luu gan nhat.
   *
   * Gia de di theo dong gio hang, con mau go va do trang tri di theo ban thiet
   * ke da luu. Hai ben phai khop, nen doi de xong phai luu lai moi them vao gio.
   */
  readonly standDirty = signal(false);

  readonly baseChosen = computed<DisplayBase | null>(
    () => this.bases().find((one) => one.code === this.stand().baseCode) ?? null,
  );

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
    () =>
      this.chosenProduct() &&
      this.designId() !== null &&
      !this.addedToCart() &&
      !this.standDirty() &&
      this.photosReady(),
  );

  /** Loads the pet profiles the design can be tied to. */
  loadPets(): void {
    // Doi be thi dem lai anh; ban da luu gan voi be cu nen phai luu lai moi them vao gio.
    this.form.controls.petId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((pet) => {
      this.petChosen.set(pet);
      this.refreshPhotos();
      if (this.designId()) {
        this.standDirty.set(true);
        this.addedToCart.set(false);
      }
    });
    this.petsService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (list) => this.pets.set(list), error: () => this.pets.set([]) });
  }

  loadCatalog(): void {
    this.catalog.accessory$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.accessoryCatalog.set(list.filter((one) => one.enabled)),
      error: () => this.accessoryCatalog.set([]),
    });
    this.catalog.displayBase$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (ds) => this.bases.set(ds),
      error: () => this.bases.set([]),
    });
    this.catalog.packaging$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.packagingCatalog.set(list.filter((one) => one.enabled)),
      error: () => this.packagingCatalog.set([]),
    });
    this.catalog.product$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ds) => this.types.set(ds.filter((l) => l.enabled)),
        error: () => this.types.set([]),
      });
  }

  /** Chon mot mau hop hoac khung; chon lai mau dang chon, hoac de trong, la bo. */
  selectPackaging(kind: PackagingKind, code: string): void {
    this.packagingPicked.update((now) => {
      const next = { ...now };
      if (!code || now[kind] === code) {
        delete next[kind];
      } else {
        next[kind] = code;
      }
      return next;
    });
    // Doi hop hay khung la mot mon khac trong gio, nen cho them vao gio lai.
    this.addedToCart.set(false);
    this.fetchQuote();
  }

  selectBase(code: string): void {
    this.changeStand({ baseCode: code });
  }

  selectTone(tone: StandTone): void {
    this.changeStand({ tone });
  }

  /** Bat tat mot mon trang tri, toi da so cho tren de. */
  toggleDecoration(code: StandDecoration): void {
    const now = this.stand().decorations;
    if (now.includes(code)) {
      this.changeStand({ decorations: now.filter((one) => one !== code) });
    } else if (now.length < STAND_DECORATION_MAX) {
      this.changeStand({ decorations: [...now, code] });
    }
  }

  private changeStand(patch: Partial<StandChoice>): void {
    this.stand.update((now) => ({ ...now, ...patch }));
    this.markChanged();
  }

  /**
   * Gan hoac go mot phu kien.
   *
   * Chon mon moi o diem neo da co mon thi thay mon cu. Da du so mon cua kich
   * co thi khong gan them; may chu cung chan lai lan nua khi luu va khi them vao gio.
   */
  toggleAccessory(code: string): boolean {
    const now = this.accessoryPicked();
    if (now.includes(code)) {
      this.accessoryPicked.set(now.filter((one) => one !== code));
      this.markChanged();
      return true;
    }
    const anchorOf = new Map(this.accessoryCatalog().map((one) => [one.code, one.anchor]));
    const anchor = anchorOf.get(code);
    const kept = now.filter((one) => anchorOf.get(one) !== anchor);
    if (kept.length >= this.accessoryMax()) {
      return false;
    }
    this.accessoryPicked.set([...kept, code]);
    this.markChanged();
    return true;
  }

  /** Bo het phu kien, dung khi doi sang mau khong co diem neo. */
  clearAccessories(): void {
    if (this.accessoryPicked().length > 0) {
      this.accessoryPicked.set([]);
      this.markChanged();
    }
  }

  /** De hay phu kien doi: gia doi theo, va ban da luu khong con khop voi man hinh. */
  private markChanged(): void {
    this.addedToCart.set(false);
    if (this.designId()) {
      this.standDirty.set(true);
    }
    this.fetchQuote();
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
    // Kich co nho nhan it phu kien hon: bo bot nhung mon chon sau cung cho vua.
    const max = this.accessoryMax();
    if (this.accessoryPicked().length > max) {
      this.accessoryPicked.set(this.accessoryPicked().slice(0, max));
      if (this.designId()) {
        this.standDirty.set(true);
      }
    }
    this.fetchQuote();
  }

  /** The price is always asked of the server, never taken from the cached catalog. */
  private fetchQuote(): void {
    const kind = this.codeKindSelected();
    const size = this.sizeCodeSelected();
    if (!kind || !size) {
      return;
    }
    const base = this.stand().baseCode;
    this.designs
      .quote(kind, size, base === BASE_NONE ? '' : base, this.accessoryPicked(), this.packagingCodes())
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
    zonePaint: { zone: string; colorCode: string }[],
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
      zonePaint,
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
      stand: { ...this.stand(), decorations: [...this.stand().decorations] },
      accessories: [...this.accessoryPicked()],
      featureNote: v.featureNote.trim(),
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
          this.standDirty.set(false);
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
        displayBaseCode: this.stand().baseCode || undefined,
        packagingCodes: this.packagingCodes(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.addedToCart.set(true),
        error: (trouble: { error?: { code?: string } }) => this.error.set(cartErrorKey(trouble?.error?.code)),
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
          this.stand.set({
            baseCode: tk.stand?.baseCode || BASE_NONE,
            tone: (tk.stand?.tone as StandTone) || 'OAK',
            decorations: [...((tk.stand?.decorations ?? []) as StandDecoration[])],
          });
          this.accessoryPicked.set([...(tk.accessories ?? [])]);
          this.standDirty.set(false);
          this.form.patchValue({
            name: tk.name,
            engravedName: tk.engraving?.name ?? '',
            memorialDate: tk.engraving?.memorialDate ? tk.engraving.memorialDate.slice(0, 10) : '',
            message: tk.engraving?.message ?? '',
            featureNote: tk.featureNote ?? '',
          });
          // Dat be ma khong phat su kien doi be, de ban vua mo khong bi coi la chua luu.
          this.form.controls.petId.setValue(tk.pet ?? '', { emitEvent: false });
          this.petChosen.set(tk.pet ?? '');
          this.refreshPhotos();
          if (tk.productTypeCode && tk.sizeCode) {
            this.fetchQuote();
          }
          onDone(tk);
        },
        error: () => this.error.set('STUDIO.ERROR_OPEN_DRAFT'),
      });
  }
}

/** Ma loi may chu tra khi them hang tuy bien vao gio, doi ra cau de hieu. */
const CART_ERROR: Record<string, string> = {
  NEED_DESIGN: 'STUDIO.CART_NEED_DESIGN',
  NEED_PET: 'STUDIO.CART_NEED_PET',
  NEED_PHOTOS: 'STUDIO.CART_NEED_PHOTOS',
};

export function cartErrorKey(code: string | undefined): string {
  return (code && CART_ERROR[code]) || 'COMMON.GENERIC_ERROR';
}
