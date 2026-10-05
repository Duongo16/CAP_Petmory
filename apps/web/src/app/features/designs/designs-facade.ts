import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { DesignsService } from '../../core/services/designs.service';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { Design, DisplayBase, ProductType } from '../../core/models/api.model';
import { ModelLibrary, currentModelCode } from '../studio/model-manifest';
import { BASE_NONE } from '../../shared/viewer-3d/stand-options';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

/** Trang thai cua mot ban thiet ke tren duong toi don hang. */
export type DesignStage = 'DRAFT' | 'READY' | 'IN_CART';

/** Moi tai khoan luu toi da bay nhieu ban, dung nhu gioi han may chu. */
export const DESIGN_LIMIT = 30;

const KEY_STAGE: Record<DesignStage, string> = {
  DRAFT: 'DESIGNS.STATUS.DRAFT',
  READY: 'DESIGNS.STATUS.READY',
  IN_CART: 'DESIGNS.STATUS.IN_CART',
};

/** Mot the tren trang, moi chu da duoc tinh san. */
export interface DesignCard {
  raw: Design;
  modelName: string;
  productLabel: string;
  standLabel: string;
  engravedName: string;
  previewAngle: string;
  version: string;
  stage: DesignStage;
  stageKey: string;
  editing: boolean;
  confirming: boolean;
  busy: boolean;
}

/**
 * Giu danh sach ban thiet ke da luu va moi thao tac tren no: doi ten, xoa,
 * them vao gio. Gio hang doc tu dich vu dung chung, nen the biet ban nao dang
 * nam trong gio ma khong phai hoi them may chu.
 */
import { cartErrorKey } from '../studio/studio-facade';

@Injectable()
export class DesignsFacade {
  private readonly http = inject(HttpClient);
  private readonly designs = inject(DesignsService);
  private readonly cart = inject(CartService);
  private readonly catalog = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly list = signal<Design[]>([]);
  private readonly library = signal<ModelLibrary | null>(null);
  private readonly products = signal<ProductType[]>([]);
  private readonly bases = signal<DisplayBase[]>([]);
  private readonly editingId = signal<string | null>(null);
  private readonly confirmingId = signal<string | null>(null);
  private readonly busyId = signal<string | null>(null);

  readonly status = signal<ScreenState>('LOADING');
  /** Loi cua thao tac gan nhat, la key ban dich. */
  readonly problem = signal<string | null>(null);
  /** Ma ban vua them vao gio, de noi ngay tren the. */
  readonly justAdded = signal<string | null>(null);

  readonly count = computed(() => this.list().length);
  readonly limit = DESIGN_LIMIT;

  readonly cards = computed<DesignCard[]>(() => {
    const library = this.library();
    const modelName = new Map((library?.baseModel ?? []).map((m) => [m.code, m.name]));
    const products = new Map(this.products().map((p) => [p.code, p]));
    const bases = new Map(this.bases().map((b) => [b.code, b.displayName]));
    const inCart = new Set(this.cart.cart().items.flatMap((m) => (m.designId ? [m.designId] : [])));
    const editing = this.editingId();
    const confirming = this.confirmingId();
    const busy = this.busyId();

    return this.list().map((raw) => {
      const code = library ? currentModelCode(raw.modelCode, library) : raw.modelCode;
      const product = products.get(raw.productTypeCode);
      const size = product?.sizes.find((one) => one.code === raw.sizeCode);
      const baseCode = raw.stand?.baseCode ?? '';
      const angles = raw.preview.map((p) => p.angle as string);
      let stage: DesignStage = 'DRAFT';
      if (inCart.has(raw._id)) {
        stage = 'IN_CART';
      } else if (raw.productTypeCode && raw.sizeCode) {
        stage = 'READY';
      }
      return {
        raw,
        modelName: modelName.get(code) ?? raw.modelCode,
        productLabel: product ? `${product.name} · ${size?.displayName ?? raw.sizeCode}` : '',
        standLabel: baseCode && baseCode !== BASE_NONE ? (bases.get(baseCode) ?? baseCode) : '',
        engravedName: raw.engraving?.name ?? '',
        previewAngle: angles.includes('ISO') ? 'ISO' : (angles[0] ?? ''),
        version: raw.updatedAt,
        stage,
        stageKey: KEY_STAGE[stage],
        editing: editing === raw._id,
        confirming: confirming === raw._id,
        busy: busy === raw._id,
      };
    });
  });

  load(): void {
    this.status.set('LOADING');
    this.designs
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.list.set(rows);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
    this.http
      .get<ModelLibrary>('/models/manifest.json')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (lib) => this.library.set(lib), error: () => this.library.set(null) });
    this.catalog.product$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (rows) => this.products.set(rows), error: () => this.products.set([]) });
    this.catalog.displayBase$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (rows) => this.bases.set(rows), error: () => this.bases.set([]) });
    // Doc lai gio de biet ban nao dang nam trong gio.
    this.cart
      .reload()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => this.problem.set('COMMON.GENERIC_ERROR') });
  }

  startRename(id: string): void {
    this.confirmingId.set(null);
    this.editingId.set(id);
  }

  cancelRename(): void {
    this.editingId.set(null);
  }

  rename(id: string, name: string): void {
    const clean = name.trim();
    if (!clean) {
      return;
    }
    this.run(id, this.designs.rename(id, clean), (saved) => {
      this.list.update((rows) => rows.map((one) => (one._id === id ? { ...one, name: saved.name } : one)));
      this.editingId.set(null);
    });
  }

  askRemove(id: string): void {
    this.editingId.set(null);
    this.confirmingId.set(id);
  }

  cancelRemove(): void {
    this.confirmingId.set(null);
  }

  remove(id: string): void {
    this.run(id, this.designs.hide(id), () => {
      this.list.update((rows) => rows.filter((one) => one._id !== id));
      this.confirmingId.set(null);
    });
  }

  addToCart(design: Design): void {
    if (!design.productTypeCode || !design.sizeCode) {
      return;
    }
    const base = design.stand?.baseCode;
    this.run(
      design._id,
      this.cart.add({
        productTypeCode: design.productTypeCode,
        sizeCode: design.sizeCode,
        quantity: 1,
        designId: design._id,
        petName: design.engraving?.name || undefined,
        displayBaseCode: base || undefined,
      }),
      () => this.justAdded.set(design._id),
    );
  }

  /** Chay mot thao tac tren mot the, khoa the do trong luc cho va doi loi thanh key ban dich. */
  private run<T>(id: string, call: Observable<T>, done: (value: T) => void): void {
    this.problem.set(null);
    this.busyId.set(id);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => {
        this.busyId.set(null);
        done(value);
      },
      error: (trouble: HttpErrorResponse) => {
        this.busyId.set(null);
        const code = (trouble.error as { code?: string } | null)?.code;
        this.problem.set(trouble.status === 409 ? 'DESIGNS.ERROR_IN_CART' : cartErrorKey(code));
      },
    });
  }
}
