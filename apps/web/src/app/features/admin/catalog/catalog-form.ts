import { ChangeDetectionStrategy, Component, effect, input, output, signal, untracked } from '@angular/core';
import { FormControl, FormRecord, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { CatalogBody } from '../../../core/services/catalog-admin.service';

/** Mot o trong bieu mau danh muc. */
export interface CatalogField {
  key: string;
  labelKey: string;
  type: 'text' | 'textarea' | 'money' | 'int' | 'select' | 'toggle';
  required?: boolean;
  /** Chi nhap luc tao, sua thi khoa lai (vi du ma). */
  createOnly?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  options?: { value: string; labelKey: string }[];
}

/** Tien may chu tra ve dang so thap phan; bieu mau chi giu phan nguyen dong. */
function wholeDong(raw: unknown): string {
  const text = raw && typeof raw === 'object' && '$numberDecimal' in raw
    ? String((raw as { $numberDecimal: string }).$numberDecimal)
    : String(raw ?? '');
  return text.split('.')[0];
}

const MONEY = /^\d{1,12}$/;
const INT = /^\d{1,6}$/;

/**
 * Bieu mau dung chung cho moi muc danh muc: loai san pham, kich co, de, phu
 * kien, hop va khung. Tra ve cac o da chuan hoa; trang goi moi la noi gui len
 * may chu, va may chu kiem lai tat ca.
 */
@Component({
  selector: 'pm-catalog-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './catalog-form.html',
  styleUrl: './catalog-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogForm {
  readonly fields = input.required<CatalogField[]>();
  /** Ban ghi dang sua; rong la dang tao moi. */
  readonly initial = input<object | null>(null);
  readonly busy = input(false);
  readonly formId = input('catalog-form');

  readonly saved = output<CatalogBody>();
  readonly cancelled = output<void>();

  readonly text = new FormRecord<FormControl<string>>({});
  readonly flags = new FormRecord<FormControl<boolean>>({});
  readonly invalid = signal(false);
  readonly editing = signal(false);

  private readonly rebuild = effect(() => {
    const fields = this.fields();
    const initial = this.initial();
    untracked(() => this.build(fields, initial));
  });

  submit(): void {
    this.text.markAllAsTouched();
    if (this.text.invalid) {
      this.invalid.set(true);
      return;
    }
    this.invalid.set(false);
    const body: CatalogBody = {};
    for (const field of this.fields()) {
      if (field.createOnly && this.editing()) {
        continue;
      }
      if (field.type === 'toggle') {
        body[field.key] = this.flags.controls[field.key].value;
        continue;
      }
      const value = this.text.controls[field.key].value.trim();
      if (value === '' && !field.required) {
        if (field.type === 'text' || field.type === 'textarea') {
          body[field.key] = '';
        }
        continue;
      }
      body[field.key] = field.type === 'int' ? Number(value) : field.key === 'code' ? value.toUpperCase() : value;
    }
    this.saved.emit(body);
  }

  private build(fields: CatalogField[], initial: object | null): void {
    const raw = (initial ?? {}) as Record<string, unknown>;
    this.editing.set(initial !== null);
    this.invalid.set(false);
    for (const name of Object.keys(this.text.controls)) {
      this.text.removeControl(name);
    }
    for (const name of Object.keys(this.flags.controls)) {
      this.flags.removeControl(name);
    }
    for (const field of fields) {
      if (field.type === 'toggle') {
        this.flags.addControl(field.key, new FormControl(raw[field.key] === undefined ? true : Boolean(raw[field.key]), { nonNullable: true }));
        continue;
      }
      const start = field.type === 'money' ? wholeDong(raw[field.key]) : String(raw[field.key] ?? field.options?.[0]?.value ?? '');
      const control = new FormControl(start, { nonNullable: true, validators: this.rules(field) });
      if (field.createOnly && initial !== null) {
        control.disable();
      }
      this.text.addControl(field.key, control);
    }
  }

  private rules(field: CatalogField): ValidatorFn[] {
    const list: ValidatorFn[] = [];
    if (field.required) {
      list.push(Validators.required);
    }
    if (field.maxLength) {
      list.push(Validators.maxLength(field.maxLength));
    }
    if (field.type === 'money') {
      list.push(Validators.pattern(MONEY));
    }
    if (field.type === 'int') {
      list.push(Validators.pattern(INT));
      if (field.min !== undefined) {
        list.push(Validators.min(field.min));
      }
      if (field.max !== undefined) {
        list.push(Validators.max(field.max));
      }
    }
    if (field.pattern) {
      list.push(Validators.pattern(field.pattern));
    }
    return list;
  }
}
