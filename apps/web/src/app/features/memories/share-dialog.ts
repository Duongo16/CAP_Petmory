import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { MemoriesFacade } from './memories-facade';
import { Icon } from '../../shared/icon/icon';

/** Cai hop nay lam viec thang tren kho cua man hinh nhat ky dang mo. */
export interface ShareRequest {
  facade: MemoriesFacade;
  origin: string;
}

/**
 * Quan ly cac duong dan chia se cua mot quyen nhat ky.
 *
 * Ma cua mot duong dan chi hien ngay sau khi tao, vi may chu khong giu ban
 * nguyen van. Mat cua so nay la mat ma, va nguoi dung phai tao duong khac.
 */
@Component({
  selector: 'pm-share-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, TranslatePipe, Icon],
  templateUrl: './share-dialog.html',
  styleUrl: './share-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareDialog {
  private readonly ref = inject(MatDialogRef<ShareDialog>);
  private readonly data = inject<ShareRequest>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);

  readonly facade = this.data.facade;

  readonly form = this.fb.nonNullable.group({ expiresAt: [''] });

  /** Duong dan day du cua ma vua tao, de nguoi dung sao lai mot lan. */
  readonly freshLink = computed(() => {
    const code = this.facade.newCode();
    return code ? `${this.data.origin}/d/${code}` : '';
  });

  make(): void {
    const chosen = this.form.getRawValue().expiresAt;
    this.facade.makeShare(chosen ? new Date(chosen).toISOString() : undefined);
  }

  revoke(id: string): void {
    this.facade.revokeShare(id);
  }

  /** Turns the whole diary public or private. A share link only works while it is public. */
  changePublic(event: Event): void {
    this.facade.setPublic((event.target as HTMLInputElement).checked);
  }

  close(): void {
    this.ref.close();
  }
}
