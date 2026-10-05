import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { CatalogAdminService, CatalogBody } from '../../../core/services/catalog-admin.service';
import { ProductType } from '../../../core/models/api.model';
import { MoneyPipe } from '../../../shared/money.pipe';
import { CatalogField, CatalogForm } from './catalog-form';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

const CODE_FIELD: CatalogField = {
  key: 'code', labelKey: 'ADMIN.CATALOG.CODE', type: 'text', required: true, createOnly: true, maxLength: 30, pattern: /^[A-Za-z0-9-]{2,30}$/,
};

const TYPE_FIELDS: CatalogField[] = [
  CODE_FIELD,
  { key: 'name', labelKey: 'ADMIN.CATALOG.NAME', type: 'text', required: true, maxLength: 120 },
  { key: 'material', labelKey: 'ADMIN.CATALOG.MATERIAL', type: 'text', maxLength: 200 },
  { key: 'sortOrder', labelKey: 'ADMIN.CATALOG.ORDER', type: 'int', min: 0, max: 9999 },
  { key: 'imageUrl', labelKey: 'ADMIN.CATALOG.IMAGE', type: 'text', maxLength: 500 },
  { key: 'description', labelKey: 'ADMIN.CATALOG.DESCRIPTION', type: 'textarea', maxLength: 1000 },
  { key: 'enabled', labelKey: 'ADMIN.CATALOG.ENABLED', type: 'toggle' },
];

/** Moi kich co co mo ta, anh, gia, so ngay lam, rang buoc so anh va so phu kien (muc 12). */
const SIZE_FIELDS: CatalogField[] = [
  CODE_FIELD,
  { key: 'displayName', labelKey: 'ADMIN.CATALOG.NAME', type: 'text', required: true, maxLength: 80 },
  { key: 'dimensions', labelKey: 'ADMIN.CATALOG.DIMENSIONS', type: 'text', required: true, maxLength: 80 },
  { key: 'price', labelKey: 'ADMIN.CATALOG.PRICE', type: 'money', required: true },
  { key: 'productionDays', labelKey: 'ADMIN.CATALOG.PRODUCTION_DAYS', type: 'int', required: true, min: 1, max: 120 },
  { key: 'minPhotos', labelKey: 'ADMIN.CATALOG.MIN_PHOTOS', type: 'int', min: 1, max: 20 },
  { key: 'maxAccessories', labelKey: 'ADMIN.CATALOG.MAX_ACCESSORIES', type: 'int', min: 0, max: 10 },
  { key: 'imageUrl', labelKey: 'ADMIN.CATALOG.IMAGE', type: 'text', maxLength: 500 },
  { key: 'explainer', labelKey: 'ADMIN.CATALOG.EXPLAINER', type: 'textarea', required: true, maxLength: 300 },
  { key: 'enabled', labelKey: 'ADMIN.CATALOG.ENABLED', type: 'toggle' },
];

/** Dang mo bieu mau nao: loai san pham (ma rong la them moi) hay kich co cua mot loai. */
type Editing =
  | { what: 'TYPE'; code: string }
  | { what: 'SIZE'; type: string; code: string }
  | null;

/**
 * Loai san pham va kich co (muc 12). Doi gia hay so ngay lam chi anh huong don
 * moi; dong don cu giu nguyen gia luc dat.
 */
@Component({
  selector: 'pm-catalog-products-panel',
  standalone: true,
  imports: [TranslatePipe, MoneyPipe, CatalogForm],
  templateUrl: './catalog-products-panel.html',
  styleUrls: ['../admin-shared.scss', './catalog-panel.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogProductsPanel implements OnInit {
  private readonly service = inject(CatalogAdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly types = signal<ProductType[]>([]);
  readonly editing = signal<Editing>(null);
  readonly busy = signal(false);
  readonly problem = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly typeFields = TYPE_FIELDS;
  readonly sizeFields = SIZE_FIELDS;

  /** Ban ghi dang sua, de dien san vao bieu mau. */
  readonly chosen = computed<object | null>(() => {
    const now = this.editing();
    if (!now || !now.code) {
      return null;
    }
    if (now.what === 'TYPE') {
      return this.types().find((one) => one.code === now.code) ?? null;
    }
    return this.types().find((one) => one.code === now.type)?.sizes.find((size) => size.code === now.code) ?? null;
  });

  readonly typeFormOpen = computed(() => this.editing()?.what === 'TYPE');
  readonly editingTypeCode = computed(() => {
    const now = this.editing();
    return now?.what === 'TYPE' ? now.code : null;
  });
  readonly sizeFormFor = computed(() => {
    const now = this.editing();
    return now?.what === 'SIZE' ? now.type : null;
  });

  ngOnInit(): void {
    this.load();
  }

  newType(): void {
    this.open({ what: 'TYPE', code: '' });
  }

  editType(code: string): void {
    this.open({ what: 'TYPE', code });
  }

  newSize(type: string): void {
    this.open({ what: 'SIZE', type, code: '' });
  }

  editSize(type: string, code: string): void {
    this.open({ what: 'SIZE', type, code });
  }

  cancel(): void {
    this.editing.set(null);
  }

  save(body: CatalogBody): void {
    const now = this.editing();
    if (!now) {
      return;
    }
    let call: Observable<unknown>;
    if (now.what === 'TYPE') {
      call = now.code ? this.service.updateProduct(now.code, body) : this.service.createProduct(body);
    } else {
      call = now.code ? this.service.updateSize(now.type, now.code, body) : this.service.addSize(now.type, body);
    }
    this.run(call, () => this.editing.set(null));
  }

  toggleType(code: string, on: boolean): void {
    this.run(this.service.updateProduct(code, { enabled: on }), () => undefined);
  }

  toggleSize(type: string, code: string, on: boolean): void {
    this.run(this.service.updateSize(type, code, { enabled: on }), () => undefined);
  }

  private open(next: Editing): void {
    this.problem.set(null);
    this.notice.set(null);
    this.editing.set(next);
  }

  private run(call: Observable<unknown>, after: () => void): void {
    this.problem.set(null);
    this.notice.set(null);
    this.busy.set(true);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        after();
        this.notice.set('ADMIN.CATALOG.SAVED');
        this.load();
      },
      error: (trouble: HttpErrorResponse) => {
        this.busy.set(false);
        this.problem.set(trouble.status === 409 ? 'ADMIN.CATALOG.DUPLICATE' : trouble.status === 400 ? 'ADMIN.CATALOG.INVALID' : 'COMMON.GENERIC_ERROR');
      },
    });
  }

  private load(): void {
    this.status.set('LOADING');
    this.service
      .products()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.types.set(list);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }
}
