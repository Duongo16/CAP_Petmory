import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import { PetArt } from '../../shared/pet-art/pet-art';
import { Viewer3d } from '../../shared/viewer-3d/viewer-3d';
import { MoneyPipe } from '../../shared/money.pipe';
import { StudioFacade } from './studio-facade';
import { StandardAngle, MaterialZone } from '../../shared/viewer-3d/engine-3d';
import { PaintMode } from '../../shared/viewer-3d/painter';
import { CatalogService } from '../../core/services/catalog.service';
import { PreviewAngle, ColorCode, ZonePaint } from '../../core/models/api.model';
import { BaseModel, ModelLibrary, DeclaredZone, ZoneName } from './model-manifest';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

/** Bon ngan do nghe cua ban len, theo thu tu nguoi dung di qua. */
export type Step = 'MODEL' | 'COLOR' | 'ENGRAVE' | 'FINISH';

export const STEPS: Step[] = ['MODEL', 'COLOR', 'ENGRAVE', 'FINISH'];

/** Nhan va bieu tuong cua tung ngan, viet ra tung key de tim duoc. */
const STEP_VIEW: Record<Step, { key: string; icon: string }> = {
  MODEL: { key: 'STUDIO.TAB.MODEL', icon: 'paw' },
  COLOR: { key: 'STUDIO.TAB.COLOR', icon: 'sparkle' },
  ENGRAVE: { key: 'STUDIO.TAB.ENGRAVE', icon: 'pencil' },
  FINISH: { key: 'STUDIO.TAB.FINISH', icon: 'gift' },
};

const KEY_KIND: Record<string, string> = {
  DOG: 'STUDIO.KIND.DOG',
  CAT: 'STUDIO.KIND.CAT',
  BIRD: 'STUDIO.KIND.BIRD',
  OTHER: 'STUDIO.KIND.OTHER',
};

/** Nhom dang cua mau nen, kem key ban dich. */
const KEY_STYLE: Record<string, string> = {
  FELTED: 'STUDIO.FELTED',
  REALISTIC: 'STUDIO.REALISTIC',
  BLOCKY: 'STUDIO.BLOCKY',
};

const KEY_ANGLE: Record<StandardAngle, string> = {
  FRONT: 'VIEWER.ANGLE.FRONT',
  LEFT: 'VIEWER.ANGLE.LEFT',
  RIGHT: 'VIEWER.ANGLE.RIGHT',
  BACK: 'VIEWER.ANGLE.BACK',
  TOP: 'VIEWER.ANGLE.TOP',
  ISO: 'VIEWER.ANGLE.ISO',
};

/** Cac goc nhin tren thanh noi duoi san khau. */
const ANGLES: StandardAngle[] = ['ISO', 'FRONT', 'LEFT', 'RIGHT', 'BACK', 'TOP'];

export interface ZoneView {
  name: string;
  labelDisplay: string;
  colorSelected: string;
}

@Component({
  selector: 'pm-studio-page',
  standalone: true,
  imports: [Icon, PetArt, Viewer3d, RouterLink, ReactiveFormsModule, MoneyPipe, MatProgressSpinnerModule, TranslatePipe, DatePipe],
  providers: [StudioFacade],
  templateUrl: './studio-page.html',
  styleUrl: './studio-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudioPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly catalog = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly facade = inject(StudioFacade);

  private readonly viewer = viewChild(Viewer3d);

  /** Cac ma mau nguoi dung da tha len mau, theo thu tu da dung. */
  private readonly colorCodesUsed = signal<string[]>([]);

  readonly step = signal<Step>('MODEL');
  readonly status = signal<ScreenState>('LOADING');
  readonly baseModel = signal<BaseModel[]>([]);
  readonly baseModelSelected = signal<BaseModel | null>(null);
  readonly palette = signal<ColorCode[]>([]);
  readonly zoneDisplay = signal<ZoneView[]>([]);

  readonly colorPendingPaint = signal<ColorCode | null>(null);
  readonly paintMode = signal<PaintMode>('FILL');
  readonly brushSize = signal(0.06);
  readonly preview = signal<{ angle: StandardAngle; photo: string }[]>([]);
  readonly capturing = signal(false);

  readonly kindSelected = signal<string | null>(null);

  private declaredZones: DeclaredZone[] = [];
  private zoneByFile: Record<string, Record<string, ZoneName>> = {};

  /** Mau tung vung cua ban thiet ke vua mo, khi ban do chua co mau tung mat luoi. */
  private readonly zonePaintOpened = signal<ZonePaint[]>([]);

  /** Noi dung chu khac dang go, de the ten go xem truoc cap nhat ngay. */
  readonly engraving = toSignal(this.facade.form.valueChanges, {
    initialValue: this.facade.form.getRawValue(),
  });

  readonly angles = ANGLES.map((angle) => ({ angle, key: KEY_ANGLE[angle] }));

  readonly tabs = computed(() => {
    const now = this.step();
    const at = STEPS.indexOf(now);
    return STEPS.map((code, i) => ({ code, ...STEP_VIEW[code], on: code === now, done: i < at, number: i + 1 }));
  });

  readonly stepIndex = computed(() => STEPS.indexOf(this.step()));
  readonly isFirst = computed(() => this.stepIndex() === 0);
  readonly isLast = computed(() => this.stepIndex() === STEPS.length - 1);
  readonly nextKey = computed(() => (this.isLast() ? '' : STEP_VIEW[STEPS[this.stepIndex() + 1]].key));

  readonly colorByZone = computed<Record<string, string>>(() => {
    const painted = this.zonePaintOpened();
    const model = this.baseModelSelected();
    if (painted.length === 0 || !model) {
      return {};
    }
    const swatchOf = new Map(this.palette().map((one) => [one.code, one.swatch]));
    const zoneOf = this.zoneByFile[model.file] ?? {};
    const out: Record<string, string> = {};
    for (const [material, zone] of Object.entries(zoneOf)) {
      const found = painted.find((one) => one.zone === zone);
      const swatch = found ? swatchOf.get(found.colorCode) : undefined;
      if (swatch) {
        out[material] = swatch;
      }
    }
    return out;
  });

  readonly pathModel = computed(() => {
    const model = this.baseModelSelected();
    return model ? `/models/${model.file}` : '';
  });

  readonly furColors = computed(() => this.palette().filter((m) => m.group === 'FUR'));
  readonly eyesNoseColors = computed(() => this.palette().filter((m) => m.group === 'EYES_NOSE'));
  readonly colorCodePendingPaint = computed(() => this.colorPendingPaint()?.swatch ?? null);
  readonly bodyShapeSelected = computed(() => this.baseModelSelected()?.bodyShape ?? '');

  readonly kindTabs = computed(() => {
    const kinds = [...new Set(this.baseModel().map((m) => m.kind))];
    return kinds.map((kind) => ({ kind, key: KEY_KIND[kind] ?? 'STUDIO.KIND.OTHER' }));
  });

  /** The mau nen sau khi loc theo loai, kem hinh minh hoa va nhan dang. */
  readonly modelCards = computed(() => {
    const kind = this.kindSelected();
    const chosen = this.baseModelSelected()?.code;
    return this.baseModel()
      .filter((m) => !kind || m.kind === kind)
      .map((m) => ({
        raw: m,
        art: (m.kind === 'CAT' ? 'cat' : 'dog') as 'cat' | 'dog',
        styleKey: KEY_STYLE[m.styleGroup ?? 'BLOCKY'] ?? 'STUDIO.BLOCKY',
        felted: m.styleGroup === 'FELTED',
        on: m.code === chosen,
      }));
  });

  readonly furCards = computed(() => this.swatchCards(this.furColors()));
  readonly eyeCards = computed(() => this.swatchCards(this.eyesNoseColors()));

  readonly photos = computed(() => this.preview().map((m) => ({ ...m, key: KEY_ANGLE[m.angle] })));
  readonly hasPhotos = computed(() => this.preview().length === 6);
  readonly countColorInUse = computed(() => this.colorCodesUsed().length);

  readonly productCards = computed(() =>
    this.facade.types().map((kind) => ({
      raw: kind,
      on: this.facade.codeKindSelected() === kind.code,
    })),
  );

  readonly sizeCards = computed(() =>
    this.facade.sizes().map((size) => ({ raw: size, on: this.facade.sizeCodeSelected() === size.code })),
  );

  /** Trang thai nut cua san khau, doc thang tu khung 3D. */
  readonly rotating = computed(() => this.viewer()?.autoRotate() ?? true);
  readonly angleNow = computed(() => this.viewer()?.angleSelected() ?? 'ISO');

  ngOnInit(): void {
    this.facade.loadCatalog();
    this.facade.loadPets();
    const codeDraft = this.route.snapshot.queryParamMap.get('draft');
    this.http
      .get<ModelLibrary>('/models/manifest.json')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (library) => {
          this.declaredZones = library.zoneMaterial;
          this.zoneByFile = library.zoneByFile ?? {};
          const ready = library.baseModel.filter((m) => m.ready);
          this.baseModel.set(ready);
          this.status.set(ready.length > 0 ? 'READY' : 'ERROR');
          if (codeDraft) {
            this.facade.openDraft(codeDraft, (tk) => {
              this.baseModelSelected.set(ready.find((m) => m.code === tk.modelCode) ?? ready[0] ?? null);
              this.colorCodesUsed.set([...tk.colorCodesUsed]);
              this.zonePaintOpened.set(tk.paint.length === 0 ? (tk.zonePaint ?? []) : []);
            });
            return;
          }
          const first = ready.find((m) => m.styleGroup === 'FELTED') ?? ready[0] ?? null;
          this.baseModelSelected.set(first);
          this.nameDraftFor(first);
        },
        error: () => this.status.set('ERROR'),
      });

    this.catalog.color$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (ds) => this.palette.set(ds),
      error: () => this.palette.set([]),
    });
  }

  go(step: Step): void {
    this.step.set(step);
    // Sang ngan hoan tat ma chua co anh thi tu chup sau goc, de khoi phai nho bam.
    if (step === 'FINISH' && this.preview().length === 0) {
      this.capture();
    }
    if (step !== 'COLOR') {
      this.colorPendingPaint.set(null);
    }
  }

  next(): void {
    if (!this.isLast()) {
      this.go(STEPS[this.stepIndex() + 1]);
    }
  }

  back(): void {
    if (!this.isFirst()) {
      this.go(STEPS[this.stepIndex() - 1]);
    }
  }

  selectKind(kind: string): void {
    this.kindSelected.set(this.kindSelected() === kind ? null : kind);
  }

  selectBaseModel(model: BaseModel): void {
    if (this.baseModelSelected()?.code === model.code) {
      return;
    }
    this.baseModelSelected.set(model);
    this.zoneDisplay.set([]);
    this.colorPendingPaint.set(null);
    this.preview.set([]);
    // Doi mau thi mau da to khong con khop, nen bo di de khong lech.
    this.colorCodesUsed.set([]);
    this.zonePaintOpened.set([]);
    this.facade.paintSaved.set([]);
    this.nameDraftFor(model);
  }

  recordPainted(swatch: string): void {
    const code = this.palette().find((m) => m.swatch.toLowerCase() === swatch.toLowerCase())?.code;
    if (!code) {
      return;
    }
    this.colorCodesUsed.update((ds) => (ds.includes(code) ? ds : [...ds, code]));
    // Mau da doi thi bo anh cu, lan sang ngan hoan tat se chup lai.
    this.preview.set([]);
  }

  pickPaintColor(color: ColorCode): void {
    this.colorPendingPaint.update((held) => (held?.code === color.code ? null : color));
    if (this.colorPendingPaint()) {
      this.viewer()?.autoRotate.set(false);
    }
  }

  dropColor(): void {
    this.colorPendingPaint.set(null);
  }

  setPaintMode(mode: PaintMode): void {
    this.paintMode.set(mode);
  }

  setBrush(event: Event): void {
    this.brushSize.set(Number((event.target as HTMLInputElement).value) / 1000);
  }

  // --- Nut noi tren san khau, goi thang khung 3D ---

  changeAngle(angle: StandardAngle): void {
    this.viewer()?.changeAngle(angle);
  }

  toggleRotate(): void {
    this.viewer()?.toggleAutoRotate();
  }

  undo(): void {
    this.viewer()?.undo();
  }

  capture(): void {
    const viewer = this.viewer();
    if (!viewer || viewer.status() !== 'READY') {
      return;
    }
    this.capturing.set(true);
    viewer.captureSixAngles();
  }

  onSixAnglesCaptured(bundle: Record<StandardAngle, string>): void {
    this.capturing.set(false);
    this.preview.set((Object.keys(bundle) as StandardAngle[]).map((angle) => ({ angle, photo: bundle[angle] })));
  }

  labelZoneDetected(zone: MaterialZone[]): void {
    this.zoneDisplay.set(
      zone.map((v) => ({
        name: v.name,
        labelDisplay: this.declaredZones.find((k) => k.name === v.name)?.labelDisplay ?? v.name,
        colorSelected: v.colorCurrent,
      })),
    );
  }

  saveDraft(): void {
    const model = this.baseModelSelected();
    if (!model) {
      return;
    }
    this.facade.save(
      model.code,
      this.viewer()?.readStatusPaint() ?? [],
      this.colorCodesUsed(),
      this.zonePaintOf(model),
      this.preview().map((m) => ({ angle: m.angle as PreviewAngle, photo: m.photo })),
    );
  }

  addToCart(): void {
    this.facade.addToCart(this.facade.form.getRawValue().engravedName.trim());
  }

  /** Dat san ten ban thiet ke theo mau vua chon, neu nguoi dung chua tu dat. */
  private nameDraftFor(model: BaseModel | null): void {
    const control = this.facade.form.controls.name;
    if (model && (!control.value || control.pristine)) {
      control.setValue(model.name);
    }
  }

  private swatchCards(list: ColorCode[]) {
    const held = this.colorPendingPaint()?.code;
    const used = new Set(this.colorCodesUsed());
    return list.map((one) => ({ raw: one, on: one.code === held, used: used.has(one.code) }));
  }

  /** Mau cua tung vung co ten tren mo hinh dang dung, cho ho so san xuat. */
  private zonePaintOf(model: BaseModel): { zone: string; colorCode: string }[] {
    const map = this.zoneByFile[model.file] ?? {};
    const codeOf = new Map(this.palette().map((one) => [one.swatch.toLowerCase(), one.code]));
    const out = new Map<string, string>();
    for (const one of this.zoneDisplay()) {
      const zone = map[one.name];
      const code = codeOf.get(`#${one.colorSelected}`.toLowerCase()) ?? codeOf.get(one.colorSelected.toLowerCase());
      if (zone && code && !out.has(zone)) {
        out.set(zone, code);
      }
    }
    return [...out].map(([zone, colorCode]) => ({ zone, colorCode }));
  }
}
