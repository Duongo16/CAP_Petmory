import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { GoodsService } from '../../core/services/goods.service';
import { GoodsCategory } from '../../core/models/api.model';

/** Ma nhom: chu in, chu so va gach ngang, khop quy tac may chu. */
const CATEGORY_CODE = /^[A-Z0-9-]{2,30}$/;

/**
 * Quan ly nhom hang co san (muc 23): them, sua ten, thu tu, bat tat va an.
 *
 * Nhom con hang thi may chu khong cho an, man hinh bao lai de nguoi dung
 * chuyen hang sang nhom khac truoc.
 */
@Component({
  selector: 'pm-goods-category-panel',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './goods-category-panel.html',
  styleUrls: ['./admin-shared.scss', './goods-category-panel.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoodsCategoryPanel {
  private readonly service = inject(GoodsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly groups = input<GoodsCategory[]>([]);
  readonly canEdit = input(false);
  readonly changed = output<void>();

  /** Ma nhom dang sua, rong la dang them moi, null la dong bieu mau. */
  readonly editing = signal<string | null>(null);
  readonly busy = signal(false);
  readonly problem = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly form = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(CATEGORY_CODE)] }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    sortOrder: new FormControl(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(9999)] }),
    enabled: new FormControl(true, { nonNullable: true }),
  });

  startNew(): void {
    this.clear();
    this.form.reset({ code: '', name: '', description: '', sortOrder: 0, enabled: true });
    this.form.controls.code.enable();
    this.editing.set('');
  }

  startEdit(one: GoodsCategory): void {
    this.clear();
    this.form.reset({
      code: one.code,
      name: one.name,
      description: one.description,
      sortOrder: one.sortOrder,
      enabled: one.enabled,
    });
    this.form.controls.code.disable();
    this.editing.set(one.code);
  }

  cancel(): void {
    this.editing.set(null);
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.problem.set('ADMIN.GOODS.GROUP_INVALID');
      return;
    }
    const raw = this.form.getRawValue();
    const body = {
      name: raw.name.trim(),
      description: raw.description.trim(),
      sortOrder: Number(raw.sortOrder),
      enabled: raw.enabled,
    };
    const code = this.editing();
    const call = code
      ? this.service.updateCategory(code, body)
      : this.service.createCategory({ ...body, code: raw.code.trim().toUpperCase() });
    this.run(call, 'ADMIN.GOODS.GROUP_SAVED', () => this.editing.set(null));
  }

  hide(one: GoodsCategory): void {
    this.run(this.service.hideCategory(one.code), 'ADMIN.GOODS.GROUP_HIDDEN', () => undefined);
  }

  private run(call: Observable<GoodsCategory>, done: string, after: () => void): void {
    this.clear();
    this.busy.set(true);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        after();
        this.notice.set(done);
        this.changed.emit();
      },
      error: (trouble: HttpErrorResponse) => {
        this.busy.set(false);
        this.problem.set(problemKey(trouble.status));
      },
    });
  }

  private clear(): void {
    this.problem.set(null);
    this.notice.set(null);
  }
}

function problemKey(status: number): string {
  if (status === 409) {
    return 'ADMIN.GOODS.GROUP_DUPLICATE';
  }
  if (status === 400) {
    return 'ADMIN.GOODS.GROUP_NOT_EMPTY';
  }
  return 'COMMON.GENERIC_ERROR';
}
