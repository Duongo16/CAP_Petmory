import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { ColorCode, ColorGroup } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';

/** Hop thoai duoc mo voi gi. Khong co mau nghia la dang them mau moi. */
export interface MaterialFormInput {
  color: ColorCode | null;
  groupTabs: { group: ColorGroup; key: string }[];
}

/** Hop thoai tra lai gi. Trang goi moi la noi gui len may chu. */
export interface MaterialFormResult {
  code: string;
  displayName: string;
  swatch: string;
  group: ColorGroup;
  note: string;
}

const CODE_SHAPE = /^[A-Za-z0-9-]{2,30}$/;
const SWATCH_SHAPE = /^#[0-9a-fA-F]{6}$/;

/** Mau xam nhat, dung lam diem bat dau khi them mau moi. */
const SWATCH_DEFAULT = '#cccccc';

/**
 * Hop thoai them va sua mot ma mau trong bang vat lieu.
 *
 * Hop thoai chi giu bieu mau. Viec gui len may chu van thuoc ve trang vat lieu.
 */
@Component({
  selector: 'pm-material-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Icon],
  templateUrl: './material-form-dialog.html',
  styleUrl: './material-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaterialFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly ref = inject<MatDialogRef<MaterialFormDialog, MaterialFormResult>>(MatDialogRef);
  private readonly data = inject<MaterialFormInput>(MAT_DIALOG_DATA);

  readonly editing = this.data.color !== null;
  readonly groupTabs = this.data.groupTabs;

  readonly form = this.fb.nonNullable.group({
    /* Ma mau la chia khoa cua ban ghi nen chi go duoc luc tao, sua thi khoa lai. */
    code: [
      { value: this.data.color?.code ?? '', disabled: this.data.color !== null },
      [Validators.required, Validators.pattern(CODE_SHAPE)],
    ],
    displayName: [
      this.data.color?.displayName ?? '',
      [Validators.required, Validators.maxLength(80)],
    ],
    swatch: [
      this.data.color?.swatch ?? SWATCH_DEFAULT,
      [Validators.required, Validators.pattern(SWATCH_SHAPE)],
    ],
    group: [(this.data.color?.group ?? this.data.groupTabs[0].group) as ColorGroup],
    note: [this.data.color?.note ?? '', Validators.maxLength(200)],
  });

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.ref.close({
      code: raw.code.trim().toUpperCase(),
      displayName: raw.displayName.trim(),
      swatch: raw.swatch,
      group: raw.group,
      note: raw.note.trim(),
    });
  }

  close(): void {
    this.ref.close(undefined);
  }
}
