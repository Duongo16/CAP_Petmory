import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { Account, Role } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';

/** Hop thoai duoc mo voi gi. Khong co tai khoan nghia la dang them moi. */
export interface AccountFormInput {
  account: Account | null;
  role: Role;
  roleChoices: { value: Role; key: string }[];
}

/**
 * Hop thoai tra lai gi.
 *
 * Khi them moi thi ca bon truong deu co nghia. Khi sua thi chi nhom quyen va
 * trang thai bat tat duoc gui di, con dia chi thu dien tu va ten thi khoa lai.
 */
export interface AccountFormResult {
  email: string;
  fullName: string;
  password: string;
  role: Role;
  active: boolean;
  /** Gioi han rieng so ho so thu cung; rong la theo muc chung cua cua hang. */
  petLimit: number | null;
}

/** Do dai mat khau toi thieu, giu bang phia may chu. */
const PASSWORD_MIN = 8;

/**
 * Hop thoai them va sua mot tai khoan.
 *
 * Hop thoai chi giu bieu mau. Viec gui len may chu, va cac quy tac khong cho tu
 * doi quyen cua chinh minh, van thuoc ve trang quan ly tai khoan va may chu.
 */
@Component({
  selector: 'pm-account-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Icon],
  templateUrl: './account-form-dialog.html',
  styleUrl: './account-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly ref = inject<MatDialogRef<AccountFormDialog, AccountFormResult>>(MatDialogRef);
  private readonly data = inject<AccountFormInput>(MAT_DIALOG_DATA);

  readonly editing = this.data.account !== null;
  readonly roleChoices = this.data.roleChoices;

  readonly form = this.fb.nonNullable.group({
    /* Dia chi thu dien tu la ten dang nhap nen chi go duoc luc tao. */
    email: [
      { value: this.data.account?.email ?? '', disabled: this.data.account !== null },
      [Validators.required, Validators.email],
    ],
    fullName: [
      { value: this.data.account?.fullName ?? '', disabled: this.data.account !== null },
      [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    ],
    password: [
      '',
      this.data.account === null
        ? [Validators.required, Validators.minLength(PASSWORD_MIN)]
        : [],
    ],
    role: [this.data.role],
    active: [this.data.account?.active ?? true],
    petLimit: [
      this.data.account?.petProfileLimit === null || this.data.account?.petProfileLimit === undefined
        ? ''
        : String(this.data.account.petProfileLimit),
      [Validators.pattern(/^\d{0,4}$/), Validators.max(1000)],
    ],
  });

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.ref.close({
      email: raw.email.trim(),
      fullName: raw.fullName.trim(),
      password: raw.password,
      role: raw.role,
      active: raw.active,
      petLimit: raw.petLimit.trim() === '' ? null : Number(raw.petLimit),
    });
  }

  close(): void {
    this.ref.close(undefined);
  }
}
