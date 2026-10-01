import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { MemoriesFacade } from './memories-facade';
import { MemoriesService } from '../../core/services/memories.service';
import { Icon } from '../../shared/icon/icon';

/** Cai hop nay lam viec thang tren kho cua man hinh nhat ky dang mo. */
export interface ExportRequest {
  facade: MemoriesFacade;
  petName: string;
}

/**
 * Xin xuat quyen nhat ky ra tep doc duoc.
 *
 * Viec dung tep chay o may chu, nen o day chi co chon khoang thoi gian, doi,
 * roi tai ve. Man hinh khong bao gio dung im: luon co mot dong noi ro dang o
 * buoc nao.
 */
@Component({
  selector: 'pm-export-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Icon],
  templateUrl: './export-dialog.html',
  styleUrl: './export-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportDialog {
  private readonly ref = inject(MatDialogRef<ExportDialog>);
  private readonly data = inject<ExportRequest>(MAT_DIALOG_DATA);
  private readonly service = inject(MemoriesService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly facade = this.data.facade;
  readonly form = this.fb.nonNullable.group({ fromDate: [''], toDate: [''] });

  /** Dia chi tam cua tep da tai ve trinh duyet, de nut luu xuong tro vao. */
  private readonly ready = signal('');

  readonly fileLink = this.ready.asReadonly();
  readonly fileName = computed(() => `nhat-ky-${this.data.petName}.pdf`);

  private readonly cleanup = this.destroyRef.onDestroy(() => this.release());

  ask(): void {
    this.release();
    this.ready.set('');
    const raw = this.form.getRawValue();
    this.facade.askExport(
      raw.fromDate ? new Date(raw.fromDate).toISOString() : undefined,
      raw.toDate ? new Date(raw.toDate).toISOString() : undefined,
    );
  }

  /**
   * Nhan tep ve trinh duyet roi dung mot dia chi tam cho nut luu xuong.
   *
   * Tep di qua duong co kiem quyen chu khong phai mot dia chi cong khai, nen
   * khong the tro thang nut luu xuong vao may chu duoc.
   */
  fetchFile(): void {
    const job = this.facade.exporting();
    if (!job) {
      return;
    }
    this.service
      .exportFile(job._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.release();
          this.ready.set(URL.createObjectURL(blob));
        },
        error: () => undefined,
      });
  }

  private release(): void {
    const old = this.ready();
    if (old) {
      URL.revokeObjectURL(old);
    }
  }

  close(): void {
    this.ref.close();
  }
}
