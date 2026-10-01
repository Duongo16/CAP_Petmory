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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSliderModule } from '@angular/material/slider';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import { Viewer3d } from '../../shared/viewer-3d/viewer-3d';
import { MoneyPipe } from '../../shared/money.pipe';
import { StudioFacade } from './studio-facade';
import { StandardAngle, MaterialZone } from '../../shared/viewer-3d/engine-3d';
import { PaintMode } from '../../shared/viewer-3d/painter';
import { CatalogService } from '../../core/services/catalog.service';
import { PreviewAngle, ColorCode, ZonePaint } from '../../core/models/api.model';
import { BaseModel, ModelLibrary, DeclaredZone, ZoneName } from './model-manifest';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

/** The four steps of the customiser, in the order the user walks through them. */
export type Step = 'PICK_MODEL' | 'APPEARANCE' | 'PREVIEW' | 'COMPLETED';

export const STEPS: Step[] = ['PICK_MODEL', 'APPEARANCE', 'PREVIEW', 'COMPLETED'];

/** Translation key lookup, declared explicitly so every key stays greppable. */
const KEY_STEP: Record<Step, string> = {
  PICK_MODEL: 'STUDIO.STEP.PICK_MODEL',
  APPEARANCE: 'STUDIO.STEP.APPEARANCE',
  PREVIEW: 'STUDIO.STEP.PREVIEW',
  COMPLETED: 'STUDIO.STEP.COMPLETED',
};

/** The species filter at the top of step one. */
const KEY_KIND: Record<string, string> = {
  DOG: 'STUDIO.KIND.DOG',
  CAT: 'STUDIO.KIND.CAT',
  OTHER: 'STUDIO.KIND.OTHER',
};

/** The pose filter beside it. Only standing is built so far. */
const KEY_POSE: Record<string, string> = {
  STANDING: 'STUDIO.POSE.STANDING',
  SITTING: 'STUDIO.POSE.SITTING',
  LYING: 'STUDIO.POSE.LYING',
};

const KEY_ANGLE: Record<StandardAngle, string> = {
  FRONT: 'VIEWER.ANGLE.FRONT',
  LEFT: 'VIEWER.ANGLE.LEFT',
  RIGHT: 'VIEWER.ANGLE.RIGHT',
  BACK: 'VIEWER.ANGLE.BACK',
  TOP: 'VIEWER.ANGLE.TOP',
  ISO: 'VIEWER.ANGLE.ISO',
};

export interface ZoneView {
  name: string;
  labelDisplay: string;
  colorSelected: string;
}

@Component({
  selector: 'pm-studio-page',
  standalone: true,
  imports: [
    Icon,
    Viewer3d,
    RouterLink,
    ReactiveFormsModule,
    MoneyPipe,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSliderModule,
    TranslatePipe,
  ],
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

  /** The colour codes the customer actually painted, kept in the order they were used. */
  private readonly colorCodesUsed = signal<string[]>([]);

  readonly steps = STEPS;
  readonly stepCurrent = signal<Step>('PICK_MODEL');

  readonly status = signal<ScreenState>('LOADING');
  readonly baseModel = signal<BaseModel[]>([]);
  readonly baseModelSelected = signal<BaseModel | null>(null);
  readonly palette = signal<ColorCode[]>([]);
  readonly zoneDisplay = signal<ZoneView[]>([]);

  readonly colorPendingPaint = signal<ColorCode | null>(null);
  readonly paintMode = signal<PaintMode>('FILL');
  readonly brushSize = signal(0.06);
  readonly preview = signal<{ angle: StandardAngle; photo: string }[]>([]);

  private declaredZones: DeclaredZone[] = [];

  /** Ban do ten mang vat lieu sang vung co ten, tra theo ten tep mo hinh. */
  private zoneByFile: Record<string, Record<string, ZoneName>> = {};

  /**
   * Mau tung vung cua ban thiet ke vua mo, khi ban do chua co mau tung mat luoi.
   *
   * Ban thiet ke sinh tu mot phuong an goi y chi ghi mau theo vung chu chua to
   * tung mat luoi. Neu khong doc cho nay thi mo ra se thay mo hinh mau goc, va
   * nguoi dung tuong phuong an ho vua chon da bi mat.
   */
  private readonly zonePaintOpened = signal<ZonePaint[]>([]);

  /**
   * Mau gan cho tung mang vat lieu cua mo hinh dang xem.
   *
   * Doi chieu nguoc: tu vung co ten ra ma mau, roi tu ma mau ra mau hien tren
   * man hinh, cuoi cung tu vung co ten ra ten mang vat lieu cua chinh tep dang
   * mo. Rong khi ban thiet ke da co mau tung mat luoi.
   */
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
    const color = this.baseModelSelected();
    return color ? `/models/${color.file}` : '';
  });

  readonly furColors = computed(() => this.palette().filter((m) => m.group === 'FUR'));
  readonly eyesNoseColors = computed(() => this.palette().filter((m) => m.group === 'EYES_NOSE'));
  readonly colorCodePendingPaint = computed(() => this.colorPendingPaint()?.swatch ?? null);

  /** Groups base models by style so the user can compare them side by side. */
  readonly colorFelted = computed(() =>
    this.modelsShown().filter((m) => m.styleGroup === 'FELTED'),
  );
  readonly colorRealistic = computed(() =>
    this.modelsShown().filter((m) => m.styleGroup === 'REALISTIC'),
  );
  readonly colorBlocky = computed(() =>
    this.modelsShown().filter((m) => m.styleGroup === 'BLOCKY' || !m.styleGroup),
  );

  /** Ten dang than cua mo hinh dang chon, rong neu no giu nguyen dang goc. */
  readonly bodyShapeSelected = computed(() => this.baseModelSelected()?.bodyShape ?? '');

  /** The species tabs, built from the models that are actually available. */
  readonly kindTabs = computed(() => {
    const kinds = [...new Set(this.baseModel().map((m) => m.kind))];
    return kinds.map((kind) => ({ kind, key: KEY_KIND[kind] ?? 'STUDIO.KIND.OTHER' }));
  });

  /** The poses available for the chosen species. Nothing is offered that has no model. */
  readonly poseTabs = computed(() => {
    const kind = this.kindSelected();
    const poses = [
      ...new Set(this.baseModel().filter((m) => !kind || m.kind === kind).map((m) => m.pose)),
    ];
    return poses.map((pose) => ({ pose, key: KEY_POSE[pose] ?? 'STUDIO.POSE.STANDING' }));
  });

  /** The models left after the species and pose filters. */
  readonly modelsShown = computed(() => {
    const kind = this.kindSelected();
    const pose = this.poseSelected();
    return this.baseModel().filter(
      (m) => (!kind || m.kind === kind) && (!pose || m.pose === pose),
    );
  });

  readonly stepCount = computed(() => this.steps.indexOf(this.stepCurrent()) + 1);
  readonly isLastStep = computed(() => this.stepCurrent() === 'COMPLETED');

  /** Precomputes the translation key for each step, so the view builds no strings. */
  readonly stepsDisplay = computed(() =>
    this.steps.map((b) => ({
      code: b,
      key: KEY_STEP[b],
      selected: b === this.stepCurrent(),
    })),
  );

  readonly photosDisplay = computed(() =>
    this.preview().map((m) => ({ ...m, key: KEY_ANGLE[m.angle] })),
  );

  readonly hasAllSixAngles = computed(() => this.preview().length === 6);

  /** Which species and pose the list is filtered to. Empty means no filter. */
  readonly kindSelected = signal<string | null>(null);
  readonly poseSelected = signal<string | null>(null);
  readonly countColorInUse = computed(() => this.colorCodesUsed().length);

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
          this.baseModelSelected.set(ready[0] ?? null);
        },
        error: () => this.status.set('ERROR'),
      });

    this.catalog.color$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (ds) => this.palette.set(ds),
      error: () => this.palette.set([]),
    });
  }

  setStep(step: Step): void {
    this.stepCurrent.set(step);
  }

  nextStep(): void {
    const i = this.steps.indexOf(this.stepCurrent());
    if (i < this.steps.length - 1) {
      this.stepCurrent.set(this.steps[i + 1]);
    }
  }

  previousStep(): void {
    const i = this.steps.indexOf(this.stepCurrent());
    if (i > 0) {
      this.stepCurrent.set(this.steps[i - 1]);
    }
  }

  /** Picking a species clears a pose that species does not offer. */
  selectKind(kind: string): void {
    this.kindSelected.set(this.kindSelected() === kind ? null : kind);
    const pose = this.poseSelected();
    if (pose && !this.poseTabs().some((p) => p.pose === pose)) {
      this.poseSelected.set(null);
    }
  }

  selectPose(pose: string): void {
    this.poseSelected.set(this.poseSelected() === pose ? null : pose);
  }

  selectBaseModel(color: BaseModel): void {
    this.baseModelSelected.set(color);
    this.zoneDisplay.set([]);
    this.colorPendingPaint.set(null);
    this.preview.set([]);
        // Switching model makes the painted colours unusable, so they are dropped to avoid a mismatch.
    this.colorCodesUsed.set([]);
    this.facade.paintSaved.set([]);
  }

  /** Records the colour code just painted, so the workshop knows which wool rolls are needed. */
  recordPainted(swatch: string): void {
    const code = this.palette().find((m) => m.swatch.toLowerCase() === swatch.toLowerCase())?.code;
    if (!code) {
      return;
    }
    this.colorCodesUsed.update((ds) => (ds.includes(code) ? ds : [...ds, code]));
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

  /**
   * Mau cua tung vung co ten tren mo hinh dang dung.
   *
   * Xuong pha len theo vung chu khong theo tung mat luoi, nen ho so san xuat
   * can bang nay. Vung nao tep mo hinh chua tach rieng thi khong co dong nao
   * o day, va ho so se noi ro la chua tach.
   */
  private zonePaintOf(model: BaseModel): { zone: string; colorCode: string }[] {
    const map = this.zoneByFile[model.file] ?? {};
    const codeOf = new Map(
      this.palette().map((one) => [one.swatch.toLowerCase(), one.code]),
    );
    const out = new Map<string, string>();
    for (const one of this.zoneDisplay()) {
      const zone = map[one.name];
      const code = codeOf.get(`#${one.colorSelected}`.toLowerCase())
        ?? codeOf.get(one.colorSelected.toLowerCase());
      if (zone && code && !out.has(zone)) {
        out.set(zone, code);
      }
    }
    return [...out].map(([zone, colorCode]) => ({ zone, colorCode }));
  }

  addToCart(): void {
    this.facade.addToCart(this.facade.form.getRawValue().engravedName.trim());
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

  /** Clicking the held colour again drops it and returns to rotate mode. */
  pickPaintColor(color: ColorCode): void {
    this.colorPendingPaint.update((h) => (h?.code === color.code ? null : color));
  }

  dropColorColor(): void {
    this.colorPendingPaint.set(null);
  }

  setPaintMode(mode: PaintMode): void {
    this.paintMode.set(mode);
  }

  setBrushSize(value: number | null): void {
    if (value !== null) {
      this.brushSize.set(value / 1000);
    }
  }

  onSixAnglesCaptured(bundle: Record<StandardAngle, string>): void {
    this.preview.set((Object.keys(bundle) as StandardAngle[]).map((angle) => ({ angle, photo: bundle[angle] })));
  }

}
