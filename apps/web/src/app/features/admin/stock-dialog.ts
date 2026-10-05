import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { GoodsService } from '../../core/services/goods.service';
import { Goods, StockMove } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';

/** Ly do toi thieu bay nhieu ky tu, giu bang phia may chu. */
const NOTE_MIN = 5;

const REASON_KEY: Record<StockMove['reason'], string> = {
  MANUAL: 'ADMIN.GOODS.REASON_MANUAL',
  ORDER_PAID: 'ADMIN.GOODS.REASON_ORDER_PAID',
  ORDER_CANCELLED: 'ADMIN.GOODS.REASON_ORDER_CANCELLED',
};

/** Hop thoai tra lai true khi da co it nhat mot lan ghi so kho. */
export type StockDialogResult = boolean;

/**
 * So kho cua mot mon hang: nhap hoac tru tung to hop kem ly do, va xem lai
 * lich su thay doi.
 *
 * So kho chi ghi them. Moi lan dieu chinh la mot dong moi kem so truoc va so
 * sau, may chu tu choi neu tru qua so hang dang co.
 */
@Component({
  selector: 'pm-stock-dialog',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, TranslatePipe, Icon],
  templateUrl: './stock-dialog.html',
  styleUrl: './stock-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockDialog implements OnInit {
  private readonly service = inject(GoodsService);
  private readonly ref = inject<MatDialogRef<StockDialog, StockDialogResult>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly goods = signal<Goods>(inject<Goods>(MAT_DIALOG_DATA));
  readonly sku = signal(this.goods().variant[0]?.sku ?? '');
  readonly moves = signal<StockMove[]>([]);
  readonly loadingMoves = signal(false);
  readonly busy = signal(false);
  readonly problem = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly noteMin = NOTE_MIN;
  readonly reasonKey = REASON_KEY;

  readonly rows = computed(() =>
    this.goods().variant.map((one) => ({
      sku: one.sku,
      label: one.optionValues.join(' · '),
      stock: one.stock,
      on: one.sku === this.sku(),
    })),
  );
  readonly current = computed(() => this.rows().find((one) => one.on) ?? null);

  readonly form = new FormGroup({
    delta: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(-1_000_000),
      Validators.max(1_000_000),
      Validators.pattern(/^-?\d+$/),
    ]),
    note: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(NOTE_MIN), Validators.maxLength(300)],
    }),
  });

  private changed = false;

  ngOnInit(): void {
    this.loadMoves();
  }

  pick(sku: string): void {
    this.sku.set(sku);
    this.problem.set(null);
    this.notice.set(null);
    this.loadMoves();
  }

  apply(): void {
    this.problem.set(null);
    this.notice.set(null);
    const delta = Number(this.form.controls.delta.value);
    const note = this.form.controls.note.value.trim();
    if (this.form.controls.delta.invalid || !Number.isInteger(delta) || delta === 0) {
      this.problem.set('ADMIN.GOODS.DELTA_ZERO');
      return;
    }
    if (note.length < NOTE_MIN) {
      this.problem.set('ADMIN.GOODS.REASON_SHORT');
      return;
    }
    const left = (this.current()?.stock ?? 0) + delta;
    if (left < 0) {
      this.problem.set('ADMIN.GOODS.NOT_ENOUGH_STOCK');
      return;
    }
    this.busy.set(true);
    this.service
      .adjustStock(this.goods().code, this.sku(), delta, note)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (fresh) => {
          this.busy.set(false);
          this.changed = true;
          this.goods.set(fresh);
          this.form.reset({ delta: null, note: '' });
          this.notice.set('ADMIN.GOODS.SAVED');
          this.loadMoves();
        },
        error: (trouble: HttpErrorResponse) => {
          this.busy.set(false);
          this.problem.set(trouble.status === 400 ? 'ADMIN.GOODS.NOT_ENOUGH_STOCK' : 'COMMON.GENERIC_ERROR');
        },
      });
  }

  close(): void {
    this.ref.close(this.changed);
  }

  private loadMoves(): void {
    if (!this.sku()) {
      return;
    }
    this.loadingMoves.set(true);
    this.service
      .stockMoves(this.goods().code, this.sku())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.moves.set(list);
          this.loadingMoves.set(false);
        },
        error: () => {
          this.moves.set([]);
          this.loadingMoves.set(false);
          this.problem.set('COMMON.GENERIC_ERROR');
        },
      });
  }
}
