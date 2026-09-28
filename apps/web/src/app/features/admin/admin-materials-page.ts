import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CatalogService } from '../../core/services/catalog.service';
import { ColorCode, ColorGroup } from '../../core/models/api.model';

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

/** One row in the table, with its label already worked out. */
interface ColorRow {
  raw: ColorCode;
  groupKey: string;
}

/** The fields of the colour being added or edited. */
interface Draft {
  code: string;
  displayName: string;
  swatch: string;
  group: ColorGroup;
  note: string;
}

function emptyDraft(): Draft {
  return { code: '', displayName: '', swatch: '#cccccc', group: 'FUR', note: '' };
}

@Component({
  selector: 'pm-admin-materials-page',
  standalone: true,
  imports: [FormsModule, TranslatePipe, MatProgressSpinnerModule],
  templateUrl: './admin-materials-page.html',
  styleUrls: ['./admin-shared.scss', './admin-materials-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMaterialsPage implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly error = signal<string | null>(null);

  private readonly colors = signal<ColorCode[]>([]);
  readonly groupFilter = signal<ColorGroup | null>(null);

  /** The code being edited. Empty means the form is adding a new colour. */
  readonly editing = signal<string | null>(null);
  readonly draft = signal<Draft>(emptyDraft());
  readonly sending = signal(false);

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

  readonly canSubmit = computed(() => {
    const d = this.draft();
    const named = d.displayName.trim().length > 0 && /^#[0-9a-fA-F]{6}$/.test(d.swatch);
    return !this.sending() && named && (this.editing() !== null || /^[A-Za-z0-9-]{2,30}$/.test(d.code));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.status.set('LOADING');
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

  /** Sets one field of the draft. Angular templates cannot spread an object. */
  setField(name: keyof Draft, value: string): void {
    this.draft.update((d) => ({ ...d, [name]: value }));
  }

  startAdd(): void {
    this.editing.set(null);
    this.draft.set(emptyDraft());
    this.error.set(null);
  }

  startEdit(row: ColorRow): void {
    this.editing.set(row.raw.code);
    this.draft.set({
      code: row.raw.code,
      displayName: row.raw.displayName,
      swatch: row.raw.swatch,
      group: row.raw.group,
      note: row.raw.note,
    });
    this.error.set(null);
  }

  cancel(): void {
    this.editing.set(null);
    this.draft.set(emptyDraft());
    this.error.set(null);
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    const d = this.draft();
    const code = this.editing();
    this.sending.set(true);
    this.error.set(null);

    const call = code
      ? this.catalog.updateColor(code, {
          displayName: d.displayName.trim(),
          swatch: d.swatch,
          group: d.group,
          note: d.note.trim(),
        })
      : this.catalog.createColor({
          code: d.code.trim().toUpperCase(),
          displayName: d.displayName.trim(),
          swatch: d.swatch,
          group: d.group,
          note: d.note.trim(),
        });

    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.sending.set(false);
        this.cancel();
        this.load();
      },
      error: () => {
        this.sending.set(false);
        this.error.set('PALETTE.SAVE_FAILED');
      },
    });
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
        error: () => this.error.set('PALETTE.SAVE_FAILED'),
      });
  }
}
