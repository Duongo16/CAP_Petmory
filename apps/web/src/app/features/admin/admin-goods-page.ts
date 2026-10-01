import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, concatMap, filter, forkJoin, of, switchMap } from 'rxjs';
import { GoodsService } from '../../core/services/goods.service';
import { AuthService } from '../../core/services/auth.service';
import { Goods, GoodsCategory } from '../../core/models/api.model';
import {
  GoodsFormDialog,
  GoodsFormInput,
  GoodsFormResult,
  GoodsFormVariant,
} from './goods-form-dialog';

type ScreenState = 'LOADING' | 'READY' | 'ERROR';

/** Trang thai man hinh luc dang doc du lieu. */
const LOADING = 'LOADING';

/** Ly do ghi vao so kho khi ton duoc sua thang trong hop thoai. */
const NOTE_FROM_FORM = 'Sua truc tiep o man quan ly hang';

/** Kich thuoc hop thoai, giong cac hop thoai khac trong trang. */
const SHEET = {
  width: 'min(820px, 96vw)',
  maxHeight: '94vh',
  panelClass: ['pm-dialog', 'pm-dialog-wide'],
};

/** Mot dong trong bang, da chuan bi de ve. */
interface GoodsRow {
  raw: Goods;
  groupName: string;
  priceRange: string;
  stock: number;
}

/**
 * Quan ly hang co san.
 *
 * Mot bang liet ke, con them va sua deu mo ra hop thoai, dung nhu moi man quan
 * ly danh muc khac trong trang.
 *
 * So ton kho van duoc ghi lai day du. Khi nguoi dung doi so ton trong hop thoai,
 * trang nay gui phan chenh lech qua duong cong tru cua may chu, nen so kho van
 * la so chi them chu khong sua, va van khong the tru qua so hang dang co.
 */
@Component({
  selector: 'pm-admin-goods-page',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './admin-goods-page.html',
  styleUrls: ['./admin-shared.scss', './admin-goods-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminGoodsPage implements OnInit {
  private readonly service = inject(GoodsService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly canEdit = inject(AuthService).isManager;

  readonly status = signal<ScreenState>(LOADING);
  readonly rows = signal<Goods[]>([]);
  readonly groups = signal<GoodsCategory[]>([]);
  readonly saving = signal(false);
  readonly problem = signal<string | null>(null);
  readonly note = signal<string | null>(null);

  readonly view = computed<GoodsRow[]>(() => {
    const nameOf = new Map(this.groups().map((one) => [one._id, one.name]));
    return this.rows().map((raw) => ({
      raw,
      groupName: nameOf.get(groupIdOf(raw)) ?? '',
      priceRange: priceRangeOf(raw),
      stock: raw.variant.reduce((sum, one) => sum + one.stock, 0),
    }));
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.status.set(LOADING);
    forkJoin({ page: this.service.adminList(), groups: this.service.adminCategories() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (got) => {
          this.rows.set(got.page.rows);
          this.groups.set(got.groups);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  /** Mo hop thoai trong de them mon moi. */
  add(): void {
    this.openSheet(null);
  }

  /** Mo cung hop thoai do, da dien san mot mon dang co. */
  edit(one: Goods): void {
    this.openSheet(one);
  }

  /** Xoa mot mon hang. Don cu van giu nguyen ten va gia da chot. */
  drop(one: Goods): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.clearNotes();
    this.service
      .hide(one.code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.note.set('ADMIN.GOODS.DROPPED');
          this.reload();
        },
        error: () => {
          this.saving.set(false);
          this.problem.set('COMMON.GENERIC_ERROR');
        },
      });
  }

  private openSheet(goods: Goods | null): void {
    this.clearNotes();
    const input: GoodsFormInput = { goods, groups: this.groups() };
    this.dialog
      .open<GoodsFormDialog, GoodsFormInput, GoodsFormResult | undefined>(GoodsFormDialog, {
        ...SHEET,
        data: input,
      })
      .afterClosed()
      .pipe(
        filter((result): result is GoodsFormResult => result !== undefined),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => this.save(goods, result));
  }

  /**
   * Luu mon hang.
   *
   * Phan thong tin mon hang va phan so ton di theo hai duong khac nhau: mon
   * hang ghi de duoc, con so ton thi chi cong tru chu khong dat thang, de so
   * kho van la so chi them.
   *
   * Them moi thi may chu da luu so ton ngay luc tao, nen khong cong them mot
   * lan nua. Chi khi sua moi phai gui phan chenh lech.
   *
   * Ma mon hang cung chi gui khi tao moi: duong sua khong nhan truong ma, vi
   * ma la chia khoa cua mon hang va doi ma nghia la mot mon khac. Gui kem thi
   * may chu tu choi ca yeu cau.
   */
  private save(before: Goods | null, result: GoodsFormResult): void {
    this.saving.set(true);
    const body = {
      name: result.name,
      category: result.category,
      description: result.description,
      deliveryDays: result.deliveryDays,
      enabled: result.enabled,
      images: result.images,
      optionNames: ['Tổ hợp'],
      variant: result.variant.map((each) => ({
        sku: each.sku,
        optionValues: [each.label],
        price: each.price,
        stock: each.stock,
        enabled: each.enabled,
      })),
    };

    const write = before
      ? this.service
          .update(before.code, body)
          .pipe(switchMap((saved) => this.applyStock(saved.code, before, result.variant)))
      : this.service.create({ ...body, code: result.code });

    write.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.note.set('ADMIN.GOODS.SAVED_GOODS');
        this.reload();
      },
      error: (trouble: { error?: { message?: string | string[] } }) => {
        this.saving.set(false);
        this.problem.set(firstMessage(trouble) ?? 'COMMON.GENERIC_ERROR');
      },
    });
  }

  /**
   * Gui phan chenh lech cua tung to hop co so ton doi.
   *
   * Cac lan gui di lan luot chu khong song song, de so kho ghi dung thu tu va
   * de mot to hop khong du hang thi cac to hop truoc do van da ghi xong.
   */
  private applyStock(
    code: string,
    before: Goods,
    after: GoodsFormVariant[],
  ): Observable<unknown> {
    const had = new Map(before.variant.map((each) => [each.sku, each.stock]));
    const jobs = after
      .map((each) => ({ sku: each.sku, delta: each.stock - (had.get(each.sku) ?? 0) }))
      .filter((each) => each.delta !== 0);

    if (jobs.length === 0) {
      return of(null);
    }
    return of(...jobs).pipe(
      concatMap((each) => this.service.adjustStock(code, each.sku, each.delta, NOTE_FROM_FORM)),
    );
  }

  private clearNotes(): void {
    this.problem.set(null);
    this.note.set(null);
  }
}

/** Ma nhom cua mot mon hang, du nhom duoc tra ve dang ma hay dang ban ghi. */
function groupIdOf(one: Goods): string {
  const group = one.category as unknown;
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

/** Khoang gia cua mot mon hang, viet cho nguoi doc. */
function priceRangeOf(one: Goods): string {
  const money = one.variant.map((each) => Number(wholeDong(each.price)));
  if (money.length === 0) {
    return '';
  }
  const low = Math.min(...money);
  const high = Math.max(...money);
  const show = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
  return low === high ? show(low) : `${show(low)} – ${show(high)}`;
}

/** Cau bao loi dau tien may chu tra ve, neu co. */
function firstMessage(trouble: { error?: { message?: string | string[] } }): string | null {
  const said = trouble?.error?.message;
  if (Array.isArray(said)) {
    return said[0] ?? null;
  }
  return said ?? null;
}
