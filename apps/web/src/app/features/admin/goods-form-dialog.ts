import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { Goods, GoodsCategory } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';
import { ImageLink } from '../../shared/image-link/image-link';

/** Hop thoai duoc mo voi gi. Khong co mon hang nghia la dang them mon moi. */
export interface GoodsFormInput {
  goods: Goods | null;
  groups: GoodsCategory[];
}

/** Mot to hop trong bieu mau. */
export interface GoodsFormVariant {
  sku: string;
  label: string;
  price: string;
  stock: number;
  enabled: boolean;
}

/** Hop thoai tra lai gi. Trang goi moi la noi gui len may chu. */
export interface GoodsFormResult {
  code: string;
  name: string;
  category: string;
  description: string;
  deliveryDays: number;
  enabled: boolean;
  images: string[];
  variant: GoodsFormVariant[];
}

const CODE_SHAPE = /^[A-Z0-9-]{2,40}$/;
const SKU_SHAPE = /^[A-Za-z0-9-]{2,40}$/;
const MONEY_SHAPE = /^\d{1,12}$/;

/** So ngay giao mac dinh khi them mon moi. */
const DAYS_DEFAULT = 3;

/** So anh toi da mot mon hang giu duoc, dung bang muc may chu nhan. */
const IMAGE_MAX = 8;

/**
 * Hop thoai them va sua mot mon hang co san.
 *
 * Hop thoai chi giu bieu mau. No tra ve nhung gi nguoi dung da nhap, con viec
 * gui len may chu va tinh phan chenh lech cua so ton van thuoc ve trang quan ly
 * hang, vi trang do moi biet so ton truoc do.
 */
@Component({
  selector: 'pm-goods-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Icon, ImageLink],
  templateUrl: './goods-form-dialog.html',
  styleUrl: './goods-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoodsFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly ref = inject<MatDialogRef<GoodsFormDialog, GoodsFormResult>>(MatDialogRef);
  private readonly data = inject<GoodsFormInput>(MAT_DIALOG_DATA);

  readonly editing = this.data.goods !== null;
  readonly groups = this.data.groups;

  /** Dia chi anh cua mon hang. Anh dau tien la anh dai dien. */
  readonly images = signal<string[]>(this.data.goods?.images ?? []);
  readonly imageFull = computed(() => this.images().length >= IMAGE_MAX);
  readonly imageMax = IMAGE_MAX;

  readonly form = this.fb.nonNullable.group({
    /* Ma la chia khoa cua mon hang nen chi go duoc luc tao, sua thi khoa lai. */
    code: [
      { value: this.data.goods?.code ?? '', disabled: this.data.goods !== null },
      [Validators.required, Validators.pattern(CODE_SHAPE)],
    ],
    name: [
      this.data.goods?.name ?? '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(200)],
    ],
    category: [groupIdOf(this.data.goods) || (this.data.groups[0]?._id ?? ''), Validators.required],
    description: [this.data.goods?.description ?? '', Validators.maxLength(2000)],
    deliveryDays: [
      this.data.goods?.deliveryDays ?? DAYS_DEFAULT,
      [Validators.required, Validators.min(1), Validators.max(60)],
    ],
    enabled: [this.data.goods?.enabled ?? true],
    variant: this.fb.array<ReturnType<GoodsFormDialog['makeVariant']>>(this.startingVariants()),
  });

  readonly variants = computed(() => this.form.controls.variant);

  addImage(link: string): void {
    if (this.imageFull() || this.images().includes(link)) {
      return;
    }
    this.images.update((list) => [...list, link]);
  }

  dropImage(at: number): void {
    this.images.update((list) => list.filter((_, i) => i !== at));
  }

  addVariant(): void {
    this.variantList().push(this.makeVariant('', '', '', 0, true));
  }

  dropVariant(at: number): void {
    if (this.variantList().length > 1) {
      this.variantList().removeAt(at);
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.ref.close({
      code: raw.code.trim().toUpperCase(),
      name: raw.name.trim(),
      category: raw.category,
      description: raw.description.trim(),
      deliveryDays: raw.deliveryDays,
      enabled: raw.enabled,
      images: this.images(),
      variant: raw.variant.map((each) => ({
        sku: each.sku.trim().toUpperCase(),
        label: each.label.trim(),
        price: String(each.price).trim(),
        stock: each.stock,
        enabled: each.enabled,
      })),
    });
  }

  close(): void {
    this.ref.close(undefined);
  }

  /**
   * Cac to hop co san luc mo hop thoai.
   *
   * Mon moi, hay mon cu khong con to hop nao, deu bat dau bang mot dong trong
   * de nguoi dung co cho go ngay.
   */
  private startingVariants(): ReturnType<GoodsFormDialog['makeVariant']>[] {
    const have = (this.data.goods?.variant ?? []).map((each) =>
      this.makeVariant(
        each.sku,
        each.optionValues.join(' · '),
        wholeDong(each.price),
        each.stock,
        each.enabled,
      ),
    );
    return have.length > 0 ? have : [this.makeVariant('', '', '', 0, true)];
  }

  private variantList(): FormArray {
    return this.form.controls.variant as unknown as FormArray;
  }

  private makeVariant(
    sku: string,
    label: string,
    price: string,
    stock: number,
    enabled: boolean,
  ) {
    return this.fb.nonNullable.group({
      sku: [sku, [Validators.required, Validators.pattern(SKU_SHAPE)]],
      label: [label, [Validators.required, Validators.maxLength(60)]],
      price: [price, [Validators.required, Validators.pattern(MONEY_SHAPE)]],
      stock: [stock, [Validators.required, Validators.min(0), Validators.max(1000000)]],
      enabled: [enabled],
    });
  }
}

/** Ma nhom cua mot mon hang, du nhom duoc tra ve dang ma hay dang ban ghi. */
function groupIdOf(one: Goods | null): string {
  const group = one?.category as unknown;
  if (group && typeof group === 'object' && '_id' in group) {
    return String((group as { _id: string })._id);
  }
  return String(group ?? '');
}

/** Phan nguyen cua mot so tien, du no ve dang chuoi hay dang so thap phan. */
function wholeDong(raw: unknown): string {
  const text =
    raw && typeof raw === 'object' && '$numberDecimal' in raw
      ? String((raw as { $numberDecimal: string }).$numberDecimal)
      : String(raw ?? '0');
  return text.split('.')[0];
}
