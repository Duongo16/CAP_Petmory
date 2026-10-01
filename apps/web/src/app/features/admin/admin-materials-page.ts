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
import { TranslatePipe } from '@ngx-translate/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { CatalogService } from '../../core/services/catalog.service';
import { ColorCode, ColorGroup } from '../../core/models/api.model';
import {
  MaterialFormDialog,
  MaterialFormInput,
  MaterialFormResult,
} from './material-form-dialog';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

/**
 * Translation key lookup for the colour groups. Declared explicitly so every
 * key can be found in the source. Keys are never built by joining strings.
 */
const KEY_GROUP: Record<ColorGroup, string> = {
  FUR: 'PALETTE.GROUP.FUR',
  EYES_NOSE: 'PALETTE.GROUP.EYES_NOSE',
  ACCESSORY: 'PALETTE.GROUP.ACCESSORY',
};

const GROUP_ORDER: ColorGroup[] = ['FUR', 'EYES_NOSE', 'ACCESSORY'];

/** Trang thai man hinh luc dang doc du lieu. */
const LOADING = 'LOADING';

/** Cau bao khi luu khong thanh cong. */
const SAVE_FAILED = 'PALETTE.SAVE_FAILED';

/** Kich thuoc hop thoai, giong cac hop thoai khac trong trang. */
const SHEET = { width: 'min(620px, 96vw)', maxHeight: '94vh', panelClass: 'pm-dialog' };

/** One row in the table, with its label already worked out. */
interface ColorRow {
  raw: ColorCode;
  groupKey: string;
}

/**
 * Quan ly bang mau vat lieu.
 *
 * Mot bang liet ke, con them va sua deu mo ra hop thoai.
 */
@Component({
  selector: 'pm-admin-materials-page',
  standalone: true,
  imports: [TranslatePipe, MatProgressSpinnerModule],
  templateUrl: './admin-materials-page.html',
  styleUrls: ['./admin-shared.scss', './admin-materials-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMaterialsPage implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>(LOADING);
  readonly error = signal<string | null>(null);
  readonly sending = signal(false);

  private readonly colors = signal<ColorCode[]>([]);
  readonly groupFilter = signal<ColorGroup | null>(null);

  readonly groupTabs = GROUP_ORDER.map((group) => ({ group, key: KEY_GROUP[group] }));

  /** Each row carries its translation key, so the view calls no functions. */
  readonly rows = computed<ColorRow[]>(() => {
    const group = this.groupFilter();
    return this.colors()
      .filter((c) => !group || c.group === group)
      .map((raw) => ({ raw, groupKey: KEY_GROUP[raw.group] }));
  });

  readonly countEnabled = computed(() => this.colors().filter((c) => c.enabled).length);
  readonly countTotal = computed(() => this.colors().length);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.status.set(LOADING);
    this.catalog
      .allColors()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.colors.set(list);
          this.status.set('DONE');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  filterGroup(group: ColorGroup | null): void {
    this.groupFilter.set(this.groupFilter() === group ? null : group);
  }

  /** Mo hop thoai trong de them mau moi. */
  add(): void {
    this.openSheet(null);
  }

  /** Mo cung hop thoai do, da dien san mot mau dang co. */
  edit(row: ColorRow): void {
    this.openSheet(row.raw);
  }

  /**
   * Turning a colour off takes it off the customer's palette straight away, but
   * leaves every order already placed against it untouched.
   */
  toggle(row: ColorRow): void {
    this.catalog
      .toggleColorEnabled(row.raw.code, !row.raw.enabled)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) =>
          this.colors.update((list) =>
            list.map((c) => (c.code === updated.code ? updated : c)),
          ),
        error: () => this.error.set(SAVE_FAILED),
      });
  }

  private openSheet(color: ColorCode | null): void {
    this.error.set(null);
    const input: MaterialFormInput = { color, groupTabs: this.groupTabs };
    this.dialog
      .open<MaterialFormDialog, MaterialFormInput, MaterialFormResult | undefined>(
        MaterialFormDialog,
        { ...SHEET, data: input },
      )
      .afterClosed()
      .pipe(
        filter((result): result is MaterialFormResult => result !== undefined),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => this.save(color, result));
  }

  private save(before: ColorCode | null, result: MaterialFormResult): void {
    this.sending.set(true);
    const fields = {
      displayName: result.displayName,
      swatch: result.swatch,
      group: result.group,
      note: result.note,
    };
    const call = before
      ? this.catalog.updateColor(before.code, fields)
      : this.catalog.createColor({ ...fields, code: result.code });

    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.sending.set(false);
        this.load();
      },
      error: () => {
        this.sending.set(false);
        this.error.set(SAVE_FAILED);
      },
    });
  }
}
