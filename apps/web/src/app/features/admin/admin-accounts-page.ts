import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, Subject, concatMap, filter } from 'rxjs';
import { AccountsService } from '../../core/services/accounts.service';
import { AuthService } from '../../core/services/auth.service';
import { Account, Role } from '../../core/models/api.model';
import {
  AccountFormDialog,
  AccountFormInput,
  AccountFormResult,
} from './account-form-dialog';

type ScreenState = 'LOADING' | 'READY' | 'ERROR';

/**
 * Tra key ban dich cho tung nhom quyen.
 *
 * Khai ra tung key mot de tim duoc bang tim kiem chu. Khong bao gio ghep key
 * tu chuoi.
 */
const KEY_ROLE: Record<string, string> = {
  MANAGER: 'ADMIN.ACCOUNT.ROLE_MANAGER',
  ADMIN: 'ADMIN.ACCOUNT.ROLE_ADMIN',
  SUPPORT: 'ADMIN.ACCOUNT.ROLE_SUPPORT',
  CUSTOMER: 'ADMIN.ACCOUNT.ROLE_CUSTOMER',
};

/** Nhom mac dinh khi chua biet tai khoan thuoc nhom nao. */
const ROLE_FALLBACK: Role = 'CUSTOMER';

/** Ba nhom quyen, viet ra day du de man hinh khong phai doan. */
const ROLES: Role[] = ['MANAGER', 'SUPPORT', 'ADMIN', ROLE_FALLBACK];

/** Kich thuoc hop thoai, giong cac hop thoai khac trong trang. */
const SHEET = { width: 'min(560px, 96vw)', maxHeight: '94vh', panelClass: 'pm-dialog' };

/** Mot dong trong bang, da chuan bi de ve. */
interface AccountRow {
  raw: Account;
  roleKey: string;
  role: Role;
  isSelf: boolean;
}

/**
 * Quan ly tai khoan, theo Phu luc 01 muc 1 da rut xuong ba nhom quyen.
 *
 * Man hinh nay la ranh gioi giua ba nhom: chi nhom Quan tri vien mo duoc, va
 * nhom do khong mo duoc man hinh van hanh nao khac.
 *
 * Them va sua deu mo ra hop thoai. Quy tac khong cho tu doi quyen hay tu tat
 * tai khoan cua chinh minh duoc may chu giu, o day chi khoa nut cho do nham.
 */
@Component({
  selector: 'pm-admin-accounts-page',
  standalone: true,
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './admin-accounts-page.html',
  styleUrls: ['./admin-shared.scss', './admin-accounts-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAccountsPage implements OnInit {
  private readonly service = inject(AccountsService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Cac thao tac ghi, di lan luot chu khong song song.
   *
   * Doi nhom quyen, bat tat tai khoan va tao tai khoan deu doi trang thai, nen
   * chung phai den may chu dung thu tu nguoi dung da bam.
   */
  private readonly acted = new Subject<Observable<unknown>>();

  readonly status = signal<ScreenState>('LOADING');
  readonly working = signal(false);
  readonly problem = signal('');
  readonly note = signal('');

  readonly page = signal<{ rows: Account[]; total: number; page: number; pageCount: number }>({
    rows: [],
    total: 0,
    page: 1,
    pageCount: 1,
  });
  readonly summary = signal<Record<string, number>>({});

  readonly keyword = signal('');
  readonly roleFilter = signal('');

  readonly roles = ROLES;

  /** Cac nhom quyen kem key ban dich, tinh san de khung nhin khong goi ham. */
  readonly roleChoices = computed(() =>
    ROLES.map((one) => ({ value: one, key: KEY_ROLE[one] })),
  );

  readonly rows = computed<AccountRow[]>(() => {
    const me = this.auth.user()?.id ?? '';
    return this.page().rows.map((one) => ({
      raw: one,
      role: (one.roles[0] ?? ROLE_FALLBACK) as Role,
      roleKey: KEY_ROLE[one.roles[0] ?? ROLE_FALLBACK] ?? KEY_ROLE[ROLE_FALLBACK],
      isSelf: one._id === me,
    }));
  });

  /** So tai khoan tung nhom, da chuan bi de ve. */
  readonly counts = computed(() =>
    ROLES.map((one) => ({ key: KEY_ROLE[one], count: this.summary()[one] ?? 0 })),
  );

  ngOnInit(): void {
    this.reload();

    this.acted
      .pipe(
        concatMap((work) => work),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.working.set(false);
          this.reload();
        },
        error: (trouble: { error?: { message?: string } }) => {
          this.working.set(false);
          this.problem.set(trouble?.error?.message ?? 'ADMIN.ACCOUNT.ERROR_ACT');
        },
      });
  }

  search(): void {
    this.load(1);
  }

  goTo(page: number): void {
    this.load(page);
  }

  pickRole(value: string): void {
    this.roleFilter.set(value);
    this.load(1);
  }

  /** Mo hop thoai trong de them tai khoan moi. */
  add(): void {
    this.openSheet(null, ROLE_FALLBACK);
  }

  /** Mo cung hop thoai do, da dien san mot tai khoan dang co. */
  edit(one: AccountRow): void {
    if (one.isSelf) {
      return;
    }
    this.openSheet(one.raw, one.role);
  }

  private openSheet(account: Account | null, role: Role): void {
    this.problem.set('');
    this.note.set('');
    const input: AccountFormInput = { account, role, roleChoices: this.roleChoices() };
    this.dialog
      .open<AccountFormDialog, AccountFormInput, AccountFormResult | undefined>(
        AccountFormDialog,
        { ...SHEET, data: input },
      )
      .afterClosed()
      .pipe(
        filter((result): result is AccountFormResult => result !== undefined),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => this.apply(account, result));
  }

  /**
   * Gui nhung gi da doi.
   *
   * Tao moi thi mot lenh la du. Sua thi nhom quyen va trang thai bat tat di
   * bang hai duong khac nhau, nen chi gui duong nao that su co thay doi.
   */
  private apply(before: Account | null, result: AccountFormResult): void {
    this.problem.set('');
    this.note.set('');
    this.working.set(true);

    if (!before) {
      this.acted.next(
        this.service.create({
          email: result.email,
          fullName: result.fullName,
          password: result.password,
          role: result.role,
        }),
      );
      this.note.set('ADMIN.ACCOUNT.CREATED');
      return;
    }

    const roleMoved = result.role !== (before.roles[0] ?? ROLE_FALLBACK);
    const stateMoved = result.active !== before.active;
    const limitMoved = result.petLimit !== (before.petProfileLimit ?? null);

    if (!roleMoved && !stateMoved && !limitMoved) {
      this.working.set(false);
      return;
    }
    if (roleMoved) {
      this.acted.next(this.service.changeRole(before._id, result.role));
    }
    if (stateMoved) {
      this.acted.next(this.service.setActive(before._id, result.active));
    }
    if (limitMoved) {
      this.acted.next(this.service.setPetLimit(before._id, result.petLimit));
    }
    this.note.set('ADMIN.ACCOUNT.SAVED');
  }

  private reload(): void {
    this.load(this.page().page);
    this.service
      .summary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (got) => this.summary.set(got), error: () => this.summary.set({}) });
  }

  private load(page: number): void {
    this.service
      .list(this.keyword(), this.roleFilter(), page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (got) => {
          this.page.set(got);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }
}
