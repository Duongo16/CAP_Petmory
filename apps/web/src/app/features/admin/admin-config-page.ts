import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from '../../core/services/catalog.service';
import { BusinessConfig, ColorCode, ColorGroup } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';
import {
  MaterialFormDialog,
  MaterialFormInput,
  MaterialFormResult,
} from './material-form-dialog';

export type ConfigTab = 'system' | 'ai' | 'materials' | 'qc';
type ScreenState = 'LOADING' | 'ERROR' | 'READY';
type MaterialsScreenState = 'LOADING' | 'ERROR' | 'DONE';

/** Uppercase unaccented letters, digits and spaces only, matching the server rule. */
const COLOR_ACCOUNT_HOLDER = /^[A-Z0-9 ]{2,100}$/;

/** So tien: chi chu so, toi da hai chu so thap phan, dung nhu quy tac may chu. */
const COLOR_MONEY = /^\d{1,12}(\.\d{1,2})?$/;

/** Dau xuong dong, dung de tach phieu kiem tra thanh tung muc. */
const LINE_BREAK = String.fromCharCode(10);

const KEY_GROUP: Record<ColorGroup, string> = {
  FUR: 'PALETTE.GROUP.FUR',
  EYES_NOSE: 'PALETTE.GROUP.EYES_NOSE',
  ACCESSORY: 'PALETTE.GROUP.ACCESSORY',
};

const GROUP_ORDER: ColorGroup[] = ['FUR', 'EYES_NOSE', 'ACCESSORY'];
const SAVE_FAILED = 'PALETTE.SAVE_FAILED';
const SHEET = { width: 'min(620px, 96vw)', maxHeight: '94vh', panelClass: 'pm-dialog' };

export interface ColorRow {
  raw: ColorCode;
  groupKey: string;
}

export interface TabItem {
  id: ConfigTab;
  labelKey: string;
  icon: string;
}

/** Tach mot o nhieu dong thanh danh sach muc, bo cac dong trong. */
function asLines(typed: string): string[] {
  return typed
    .split(LINE_BREAK)
    .map((one) => one.trim())
    .filter((one) => one.length > 0);
}

@Component({
  selector: 'pm-admin-config-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    Icon,
  ],
  templateUrl: './admin-config-page.html',
  styleUrls: ['./admin-shared.scss', './admin-config-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminConfigPage implements OnInit {
  private readonly service = inject(AdminService);
  private readonly catalog = inject(CatalogService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isManager = inject(AuthService).isManager;

  // Tabs
  readonly activeTab = signal<ConfigTab>('system');
  readonly tabs: TabItem[] = [
    { id: 'system', labelKey: 'ADMIN.CONFIG.TAB_SYSTEM', icon: 'cart' },
    { id: 'ai', labelKey: 'ADMIN.CONFIG.TAB_AI', icon: 'sparkle' },
    { id: 'materials', labelKey: 'ADMIN.CONFIG.TAB_MATERIALS', icon: 'paw' },
    { id: 'qc', labelKey: 'ADMIN.CONFIG.TAB_QC', icon: 'check' },
  ];

  // Config State
  readonly status = signal<ScreenState>('LOADING');
  readonly error = signal<string | null>(null);
  readonly saved = signal(false);
  readonly saving = signal(false);
  readonly lastEditedBy = signal<string | null>(null);
  readonly qcChecklistRaw = signal('');

  // Materials State
  readonly materialsStatus = signal<MaterialsScreenState>('LOADING');
  readonly materialsError = signal<string | null>(null);
  readonly materialsSending = signal(false);
  private readonly colors = signal<ColorCode[]>([]);
  readonly groupFilter = signal<ColorGroup | null>(null);
  readonly materialSearch = signal('');

  readonly groupTabs = GROUP_ORDER.map((group) => ({ group, key: KEY_GROUP[group] }));

  readonly materialRows = computed<ColorRow[]>(() => {
    const group = this.groupFilter();
    const query = this.materialSearch().trim().toLowerCase();
    return this.colors()
      .filter((c) => {
        if (group && c.group !== group) return false;
        if (query) {
          const matchName = c.displayName.toLowerCase().includes(query);
          const matchCode = c.code.toLowerCase().includes(query);
          if (!matchName && !matchCode) return false;
        }
        return true;
      })
      .map((raw) => ({ raw, groupKey: KEY_GROUP[raw.group] }));
  });

  readonly countEnabled = computed(() => this.colors().filter((c) => c.enabled).length);
  readonly countTotal = computed(() => this.colors().length);

  readonly qcPreviewLines = computed(() => asLines(this.qcChecklistRaw()));

  /**
   * These rules deliberately mirror the server's, so the user sees a mistake while
   * typing. The server still validates everything, and the UI is never trusted.
   */
  readonly form = this.fb.nonNullable.group({
    defaultPetProfileLimit: [5, [Validators.required, Validators.min(1), Validators.max(100)]],
    qrExpiryHours: [24, [Validators.required, Validators.min(1), Validators.max(720)]],
    estimatedShippingDays: [3, [Validators.required, Validators.min(1), Validators.max(60)]],
    goodShortEdgePx: [
      1024,
      [Validators.required, Validators.min(200), Validators.max(8000)],
    ],
    warnShortEdgePx: [600, [Validators.required, Validators.min(100), Validators.max(8000)]],
    maxPhotoSizeMb: [10, [Validators.required, Validators.min(1), Validators.max(50)]],
    quotaDay: [20, [Validators.required, Validators.min(0), Validators.max(10000)]],
    quotaMonth: [300, [Validators.required, Validators.min(0), Validators.max(100000)]],
    quotaYear: [3000, [Validators.required, Validators.min(0), Validators.max(1000000)]],
    suggestDay: [10, [Validators.required, Validators.min(0), Validators.max(10000)]],
    suggestMonth: [150, [Validators.required, Validators.min(0), Validators.max(100000)]],
    suggestYear: [1500, [Validators.required, Validators.min(0), Validators.max(1000000)]],
    storyDay: [10, [Validators.required, Validators.min(0), Validators.max(10000)]],
    storyMonth: [150, [Validators.required, Validators.min(0), Validators.max(100000)]],
    storyYear: [1500, [Validators.required, Validators.min(0), Validators.max(1000000)]],
    chatDay: [60, [Validators.required, Validators.min(0), Validators.max(10000)]],
    chatMonth: [900, [Validators.required, Validators.min(0), Validators.max(100000)]],
    chatYear: [9000, [Validators.required, Validators.min(0), Validators.max(1000000)]],
    priceRestorePhoto: ['0', [Validators.required, Validators.pattern(COLOR_MONEY)]],
    priceDesignSuggestion: ['0', [Validators.required, Validators.pattern(COLOR_MONEY)]],
    priceStoryWriting: ['0', [Validators.required, Validators.pattern(COLOR_MONEY)]],
    priceChatReply: ['0', [Validators.required, Validators.pattern(COLOR_MONEY)]],
    qcChecklist: ['', [Validators.required, Validators.maxLength(4000)]],
    bankCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    bankName: ['', [Validators.required, Validators.maxLength(100)]],
    accountNumber: ['', [Validators.required, Validators.pattern(/^\d{6,20}$/)]],
    accountHolder: ['', [Validators.required, Validators.pattern(COLOR_ACCOUNT_HOLDER)]],
  });

  ngOnInit(): void {
    const qTab = this.route.snapshot.queryParamMap.get('tab') as ConfigTab | null;
    if (qTab && ['system', 'ai', 'materials', 'qc'].includes(qTab)) {
      this.activeTab.set(qTab);
    }

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tab = params.get('tab') as ConfigTab | null;
      if (tab && ['system', 'ai', 'materials', 'qc'].includes(tab) && tab !== this.activeTab()) {
        this.activeTab.set(tab);
      }
    });

    this.form.controls.qcChecklist.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => this.qcChecklistRaw.set(val));

    this.reload();
    this.loadColors();
  }

  setTab(tab: ConfigTab): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  reload(): void {
    this.status.set('LOADING');
    this.service
      .getConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cf) => {
          this.fillForm(cf);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  save(): void {
    this.saved.set(false);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    if (v.warnShortEdgePx >= v.goodShortEdgePx) {
      this.error.set('ADMIN.CONFIG.THRESHOLD_ERROR');
      return;
    }
    const checklist = asLines(v.qcChecklist);
    if (checklist.length === 0) {
      this.error.set('ADMIN.CONFIG.CHECKLIST_EMPTY');
      return;
    }

    this.saving.set(true);
    this.service
      .updateConfig({
        defaultPetProfileLimit: v.defaultPetProfileLimit,
        qrExpiryHours: v.qrExpiryHours,
        estimatedShippingDays: v.estimatedShippingDays,
        goodShortEdgePx: v.goodShortEdgePx,
        warnShortEdgePx: v.warnShortEdgePx,
        maxPhotoSizeMb: v.maxPhotoSizeMb,
        aiQuota: {
          restorePhoto: { day: v.quotaDay, month: v.quotaMonth, year: v.quotaYear },
          designSuggestion: { day: v.suggestDay, month: v.suggestMonth, year: v.suggestYear },
          storyWriting: { day: v.storyDay, month: v.storyMonth, year: v.storyYear },
          chatReply: { day: v.chatDay, month: v.chatMonth, year: v.chatYear },
        },
        aiUnitPrice: {
          restorePhoto: v.priceRestorePhoto,
          designSuggestion: v.priceDesignSuggestion,
          storyWriting: v.priceStoryWriting,
          chatReply: v.priceChatReply,
        },
        qcChecklist: checklist,
        bankCode: v.bankCode,
        bankName: v.bankName,
        accountNumber: v.accountNumber,
        accountHolder: v.accountHolder,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cf) => {
          this.saving.set(false);
          this.saved.set(true);
          this.fillForm(cf);
        },
        error: (e: { status?: number }) => {
          this.saving.set(false);
          this.error.set(e.status === 403 ? 'ADMIN.ERROR_NOT_RAW_PERMISSION' : 'COMMON.GENERIC_ERROR');
        },
      });
  }

  loadColors(): void {
    this.materialsStatus.set('LOADING');
    this.catalog
      .allColors()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.colors.set(list);
          this.materialsStatus.set('DONE');
        },
        error: () => this.materialsStatus.set('ERROR'),
      });
  }

  filterGroup(group: ColorGroup | null): void {
    this.groupFilter.set(this.groupFilter() === group ? null : group);
  }

  onSearchMaterials(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.materialSearch.set(input.value);
  }

  addMaterial(): void {
    this.openMaterialSheet(null);
  }

  editMaterial(row: ColorRow): void {
    this.openMaterialSheet(row.raw);
  }

  toggleMaterial(row: ColorRow): void {
    this.catalog
      .toggleColorEnabled(row.raw.code, !row.raw.enabled)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) =>
          this.colors.update((list) =>
            list.map((c) => (c.code === updated.code ? updated : c)),
          ),
        error: () => this.materialsError.set(SAVE_FAILED),
      });
  }

  private openMaterialSheet(color: ColorCode | null): void {
    this.materialsError.set(null);
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
      .subscribe((result) => this.saveMaterial(color, result));
  }

  private saveMaterial(before: ColorCode | null, result: MaterialFormResult): void {
    this.materialsSending.set(true);
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
        this.materialsSending.set(false);
        this.loadColors();
      },
      error: () => {
        this.materialsSending.set(false);
        this.materialsError.set(SAVE_FAILED);
      },
    });
  }

  private fillForm(cf: BusinessConfig): void {
    const quota = cf.aiQuota?.restorePhoto;
    const suggest = cf.aiQuota?.designSuggestion;
    const story = cf.aiQuota?.storyWriting;
    const chat = cf.aiQuota?.chatReply;
    const price = cf.aiUnitPrice;
    const qc = (cf.qcChecklist ?? []).join(LINE_BREAK);
    this.qcChecklistRaw.set(qc);
    this.form.patchValue({
      defaultPetProfileLimit: cf.defaultPetProfileLimit,
      qrExpiryHours: cf.qrExpiryHours,
      estimatedShippingDays: cf.estimatedShippingDays,
      goodShortEdgePx: cf.goodShortEdgePx,
      warnShortEdgePx: cf.warnShortEdgePx,
      maxPhotoSizeMb: cf.maxPhotoSizeMb,
      quotaDay: quota?.day ?? 0,
      quotaMonth: quota?.month ?? 0,
      quotaYear: quota?.year ?? 0,
      suggestDay: suggest?.day ?? 0,
      suggestMonth: suggest?.month ?? 0,
      suggestYear: suggest?.year ?? 0,
      storyDay: story?.day ?? 0,
      storyMonth: story?.month ?? 0,
      storyYear: story?.year ?? 0,
      chatDay: chat?.day ?? 0,
      chatMonth: chat?.month ?? 0,
      chatYear: chat?.year ?? 0,
      priceRestorePhoto: price?.restorePhoto?.$numberDecimal ?? '0',
      priceDesignSuggestion: price?.designSuggestion?.$numberDecimal ?? '0',
      priceStoryWriting: price?.storyWriting?.$numberDecimal ?? '0',
      priceChatReply: price?.chatReply?.$numberDecimal ?? '0',
      qcChecklist: qc,
      bankCode: cf.bankCode,
      bankName: cf.bankName,
      accountNumber: cf.accountNumber,
      accountHolder: cf.accountHolder,
    });
    this.lastEditedBy.set(cf.lastEditedBy);
    if (!this.isManager()) {
      this.form.disable();
    }
  }
}
