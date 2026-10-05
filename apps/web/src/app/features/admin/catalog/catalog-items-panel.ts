import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { CatalogAdminService, CatalogBody, CatalogItem, CatalogKind } from '../../../core/services/catalog-admin.service';
import { Money } from '../../../core/models/api.model';
import { MoneyPipe } from '../../../shared/money.pipe';
import { CatalogField, CatalogForm } from './catalog-form';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

const CODE_FIELD: CatalogField = {
  key: 'code', labelKey: 'ADMIN.CATALOG.CODE', type: 'text', required: true, createOnly: true, maxLength: 30, pattern: /^[A-Za-z0-9-]{2,30}$/,
};
const NAME_FIELD: CatalogField = { key: 'displayName', labelKey: 'ADMIN.CATALOG.NAME', type: 'text', required: true, maxLength: 120 };
const PRICE_FIELD: CatalogField = { key: 'priceDelta', labelKey: 'ADMIN.CATALOG.PRICE_DELTA', type: 'money', required: true };
const ORDER_FIELD: CatalogField = { key: 'sortOrder', labelKey: 'ADMIN.CATALOG.ORDER', type: 'int', min: 0, max: 9999 };
const DESC_FIELD: CatalogField = { key: 'description', labelKey: 'ADMIN.CATALOG.DESCRIPTION', type: 'textarea', maxLength: 500 };
const IMAGE_FIELD: CatalogField = { key: 'imageUrl', labelKey: 'ADMIN.CATALOG.IMAGE', type: 'text', maxLength: 500 };
const ON_FIELD: CatalogField = { key: 'enabled', labelKey: 'ADMIN.CATALOG.ENABLED', type: 'toggle' };

/** Cac o cua tung loai muc. Ten tep mo hinh phu kien chon trong cac tep da ban giao. */
const FIELDS: Record<CatalogKind, CatalogField[]> = {
  'display-bases': [CODE_FIELD, NAME_FIELD, PRICE_FIELD, ORDER_FIELD, DESC_FIELD, ON_FIELD],
  accessories: [
    CODE_FIELD,
    NAME_FIELD,
    PRICE_FIELD,
    {
      key: 'anchor', labelKey: 'ADMIN.CATALOG.ANCHOR', type: 'select', required: true,
      options: [
        { value: 'HEAD', labelKey: 'STUDIO.ACC.ANCHOR.HEAD' },
        { value: 'FACE', labelKey: 'STUDIO.ACC.ANCHOR.FACE' },
        { value: 'NECK', labelKey: 'STUDIO.ACC.ANCHOR.NECK' },
        { value: 'BACK', labelKey: 'STUDIO.ACC.ANCHOR.BACK' },
      ],
    },
    {
      key: 'modelFile', labelKey: 'ADMIN.CATALOG.MODEL_FILE', type: 'select', required: true,
      options: ['acc-knit-hat.glb', 'acc-bow.glb', 'acc-collar-tag.glb', 'acc-scarf.glb', 'acc-round-glasses.glb', 'acc-cape.glb']
        .map((file) => ({ value: file, labelKey: file })),
    },
    ORDER_FIELD,
    IMAGE_FIELD,
    DESC_FIELD,
    ON_FIELD,
  ],
  packaging: [
    {
      key: 'kind', labelKey: 'ADMIN.CATALOG.KIND', type: 'select', required: true, createOnly: true,
      options: [
        { value: 'BOX', labelKey: 'ADMIN.CATALOG.KIND_BOX' },
        { value: 'FRAME', labelKey: 'ADMIN.CATALOG.KIND_FRAME' },
      ],
    },
    CODE_FIELD,
    NAME_FIELD,
    PRICE_FIELD,
    ORDER_FIELD,
    IMAGE_FIELD,
    DESC_FIELD,
    ON_FIELD,
  ],
};

/** Cot phu hien them tren bang, tuy loai. */
const EXTRA_KEY: Record<CatalogKind, { key: string; labelKey: string } | null> = {
  'display-bases': null,
  accessories: { key: 'anchor', labelKey: 'ADMIN.CATALOG.ANCHOR' },
  packaging: { key: 'kind', labelKey: 'ADMIN.CATALOG.KIND' },
};

const EXTRA_LABEL: Record<string, string> = {
  HEAD: 'STUDIO.ACC.ANCHOR.HEAD',
  FACE: 'STUDIO.ACC.ANCHOR.FACE',
  NECK: 'STUDIO.ACC.ANCHOR.NECK',
  BACK: 'STUDIO.ACC.ANCHOR.BACK',
  BOX: 'ADMIN.CATALOG.KIND_BOX',
  FRAME: 'ADMIN.CATALOG.KIND_FRAME',
};

/**
 * Danh sach mot loai muc danh muc (de, phu kien, hop va khung): them, sua,
 * bat tat. May chu ghi nhat ky moi lan doi; khong co xoa han, chi tat di.
 */
@Component({
  selector: 'pm-catalog-items-panel',
  standalone: true,
  imports: [TranslatePipe, MoneyPipe, CatalogForm],
  templateUrl: './catalog-items-panel.html',
  styleUrls: ['../admin-shared.scss', './catalog-panel.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogItemsPanel {
  private readonly service = inject(CatalogAdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly kind = input.required<CatalogKind>();

  readonly status = signal<ScreenState>('LOADING');
  readonly rows = signal<CatalogItem[]>([]);
  /** Ma dang sua; rong la dang them moi; null la dong bieu mau. */
  readonly editing = signal<string | null>(null);
  readonly busy = signal(false);
  readonly problem = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly fields = computed(() => FIELDS[this.kind()]);
  readonly extra = computed(() => EXTRA_KEY[this.kind()]);
  readonly chosen = computed(() => this.rows().find((one) => one.code === this.editing()) ?? null);
  readonly view = computed(() => {
    const extra = this.extra();
    return this.rows().map((raw) => ({
      raw,
      price: (raw as { priceDelta: Money }).priceDelta,
      on: (raw as { enabled?: boolean }).enabled !== false,
      extraKey: extra ? (EXTRA_LABEL[String((raw as unknown as Record<string, unknown>)[extra.key])] ?? '') : '',
    }));
  });

  private readonly reload = effect(() => {
    this.kind();
    untracked(() => this.load());
  });

  startNew(): void {
    this.clear();
    this.editing.set('');
  }

  startEdit(code: string): void {
    this.clear();
    this.editing.set(code);
  }

  cancel(): void {
    this.editing.set(null);
  }

  save(body: CatalogBody): void {
    const code = this.editing();
    const call = code
      ? this.service.updateItem(this.kind(), code, body)
      : this.service.createItem(this.kind(), body);
    this.run(call, () => this.editing.set(null));
  }

  toggle(code: string, on: boolean): void {
    this.run(this.service.updateItem(this.kind(), code, { enabled: on }), () => undefined);
  }

  private run(call: Observable<unknown>, after: () => void): void {
    this.clear();
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
      .items(this.kind())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.rows.set(list);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  private clear(): void {
    this.problem.set(null);
    this.notice.set(null);
  }
}
