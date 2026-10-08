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
import { Viewer3d } from '../../shared/viewer-3d/viewer-3d';
import { MoneyPipe } from '../../shared/money.pipe';
import { StudioFacade } from './studio-facade';
import { ANCHOR_NODE, AccessoryMount, StandardAngle, MaterialZone } from '../../shared/viewer-3d/engine-3d';
import { PaintMode } from '../../shared/viewer-3d/painter';
import { CatalogService } from '../../core/services/catalog.service';
import { AccessoryAnchor, PackagingKind, PreviewAngle, ColorCode, ZonePaint } from '../../core/models/api.model';
import { BaseModel, ModelLibrary, DeclaredZone, ZoneName, currentModelCode } from './model-manifest';
import {
  STAND_DECORATIONS,
  STAND_DECORATION_MAX,
  STAND_TONES,
  StandView,
  shapeOfBase,
} from '../../shared/viewer-3d/stand-options';

/** Ngay dang nam-thang-ngay doi sang ngay.thang.nam de khac len de. */
function dateForStand(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : '';
}

/** Gia them bang khong thi hien chu da gom thay vi so khong dong. */
/** Hai nhom dong goi khach chon them, khai key ban dich tung nhom. */
const PACK_GROUPS: { kind: PackagingKind; key: string }[] = [
  { kind: 'BOX', key: 'STUDIO.PACK.BOX' },
  { kind: 'FRAME', key: 'STUDIO.PACK.FRAME' },
];

function isZero(value: string): boolean {
  return /^0+(\.0+)?$/.test(value.trim());
}

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

/** Bon ngan do nghe cua ban len, theo thu tu nguoi dung di qua. */
export type Step = 'MODEL' | 'COLOR' | 'STAND' | 'PHOTOS' | 'FINISH';

/**
 * Thu tu cac buoc. Dung mau tu anh la tuy chon, nam gon trong buoc chon mau:
 * khach nop anh de he thong tu chon mau, hoac tu chon lay.
 */
export const STEPS: Step[] = ['MODEL', 'COLOR', 'STAND', 'PHOTOS', 'FINISH'];

/** Nhan va bieu tuong cua tung ngan, viet ra tung key de tim duoc. */
const STEP_VIEW: Record<Step, { key: string; icon: string }> = {
  MODEL: { key: 'STUDIO.TAB.MODEL', icon: 'paw' },
  COLOR: { key: 'STUDIO.TAB.COLOR', icon: 'sparkle' },
  STAND: { key: 'STUDIO.TAB.STAND', icon: 'pencil' },
  PHOTOS: { key: 'STUDIO.TAB.PHOTOS', icon: 'camera' },
  FINISH: { key: 'STUDIO.TAB.FINISH', icon: 'gift' },
};

const KEY_KIND: Record<string, string> = {
  DOG: 'STUDIO.KIND.DOG',
  CAT: 'STUDIO.KIND.CAT',
  BIRD: 'STUDIO.KIND.BIRD',
  OTHER: 'STUDIO.KIND.OTHER',
};

/** Nhan tren the mau: dang that thi ghi tu the, dang khoi thi ghi khoi vuong. */
const KEY_POSE: Record<string, string> = {
  SITTING: 'STUDIO.POSE.SITTING',
  STANDING: 'STUDIO.POSE.STANDING',
  LYING: 'STUDIO.POSE.LYING',
};

const KEY_ANCHOR: Record<AccessoryAnchor, string> = {
  HEAD: 'STUDIO.ACC.ANCHOR.HEAD',
  FACE: 'STUDIO.ACC.ANCHOR.FACE',
  NECK: 'STUDIO.ACC.ANCHOR.NECK',
  BACK: 'STUDIO.ACC.ANCHOR.BACK',
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

import { PetPhotos } from '../memories/pet-photos/pet-photos';

@Component({
  selector: 'pm-studio-page',
  standalone: true,
  imports: [Icon, Viewer3d, RouterLink, ReactiveFormsModule, MoneyPipe, MatProgressSpinnerModule, TranslatePipe, DatePipe, PetPhotos],
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
  readonly poseSelected = signal<string | null>(null);

  private declaredZones: DeclaredZone[] = [];
  private library: ModelLibrary | null = null;

  /** Ten loai, tu the va o mau tung vung cua lan dung mau gan nhat. */
  readonly matchView = computed(() => {
    const got = this.facade.match();
    if (!got) {
      return null;
    }
    const byCode = new Map(this.palette().map((one) => [one.code, one]));
    return {
      ...got,
      kindKey: KEY_KIND[got.kind] ?? 'STUDIO.KIND.OTHER',
      poseKey: KEY_POSE[got.pose] ?? '',
      swatches: got.zonePaint.map((one) => ({
        zone: one.zone,
        name: byCode.get(one.colorCode)?.displayName ?? one.colorCode,
        swatch: byCode.get(one.colorCode)?.swatch ?? '#cccccc',
      })),
    };
  });
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
  readonly rotateSelected = computed(() => this.baseModelSelected()?.rotateY ?? 0);

  /** Ten tac gia va giay phep cua mau dang chon, giay phep ghi ten bat buoc phai hien. */
  readonly credit = computed(() => this.baseModelSelected()?.credit ?? null);

  readonly kindTabs = computed(() => {
    const kinds = [...new Set(this.baseModel().map((m) => m.kind))];
    return kinds.map((kind) => ({ kind, key: KEY_KIND[kind] ?? 'STUDIO.KIND.OTHER' }));
  });

  /** Cac dang co trong thu vien, de loc theo dang (ngoi, dung, nam). */
  readonly poseTabs = computed(() => {
    const poses = [...new Set(this.baseModel().map((m) => m.pose))].filter((pose) => KEY_POSE[pose]);
    return poses.map((pose) => ({ pose, key: KEY_POSE[pose], on: this.poseSelected() === pose }));
  });

  /** The mau nen sau khi loc theo loai va dang, kem hinh minh hoa va nhan dang. */
  readonly modelCards = computed(() => {
    const kind = this.kindSelected();
    const pose = this.poseSelected();
    const chosen = this.baseModelSelected()?.code;
    return this.baseModel()
      .filter((m) => (!kind || m.kind === kind) && (!pose || m.pose === pose))
      .map((m) => ({
        raw: m,
        thumb: `/models/thumbs/${m.code}.webp`,
        tagKey: m.core || m.styleGroup !== 'BLOCKY' ? (KEY_POSE[m.pose] ?? 'STUDIO.REALISTIC') : 'STUDIO.BLOCKY',
        sitting: m.pose === 'SITTING',
        on: m.code === chosen,
      }));
  });

  readonly furCards = computed(() => this.swatchCards(this.furColors()));
  readonly eyeCards = computed(() => this.swatchCards(this.eyesNoseColors()));

  readonly photos = computed(() => this.preview().map((m) => ({ ...m, key: KEY_ANGLE[m.angle] })));
  readonly hasPhotos = computed(() => this.preview().length === 6);
  readonly countColorInUse = computed(() => this.colorCodesUsed().length);

  // --- De trung bay ---

  readonly decorationMax = STAND_DECORATION_MAX;
  readonly hasStand = computed(() => shapeOfBase(this.facade.stand().baseCode) !== null);

  readonly baseCards = computed(() => {
    const chosen = this.facade.stand().baseCode;
    return this.facade.bases().map((raw) => ({
      raw,
      on: raw.code === chosen,
      free: isZero(raw.priceDelta.$numberDecimal),
      shape: shapeOfBase(raw.code),
    }));
  });

  readonly toneCards = computed(() => {
    const chosen = this.facade.stand().tone;
    return STAND_TONES.map((one) => ({ ...one, on: one.code === chosen }));
  });

  readonly decorCards = computed(() => {
    const chosen = this.facade.stand().decorations;
    const full = chosen.length >= STAND_DECORATION_MAX;
    return STAND_DECORATIONS.map((one) => {
      const on = chosen.includes(one.code);
      return { ...one, on, disabled: !on && full };
    });
  });

  readonly decorCount = computed(() => this.facade.stand().decorations.length);

  // --- Phu kien ---

  /** Mau dang chon co diem neo thi moi gan duoc phu kien. */
  readonly canAccessorize = computed(() => (this.baseModelSelected()?.anchors ?? []).length > 0);
  readonly accessoryNote = signal<string | null>(null);

  readonly accessoryCards = computed(() => {
    const picked = this.facade.accessoryPicked();
    return this.facade.accessoryCatalog().map((raw) => ({
      raw,
      on: picked.includes(raw.code),
      free: isZero(raw.priceDelta.$numberDecimal),
      anchorKey: KEY_ANCHOR[raw.anchor],
    }));
  });

  /** Phu kien dang chon, doi ra tep va nut neo de khung ba chieu gan len mau. */
  readonly accessoryMounts = computed<AccessoryMount[]>(() => {
    if (!this.canAccessorize()) {
      return [];
    }
    const byCode = new Map(this.facade.accessoryCatalog().map((one) => [one.code, one]));
    return this.facade.accessoryPicked().flatMap((code) => {
      const one = byCode.get(code);
      return one ? [{ code, path: `/models/${one.modelFile}`, anchor: ANCHOR_NODE[one.anchor] }] : [];
    });
  });

  /** Ten cac phu kien dang chon, de dong gia ghi ro tien gom nhung gi. */
  readonly accessoryNames = computed(() => {
    const picked = new Set(this.facade.accessoryPicked());
    return this.facade
      .accessoryCatalog()
      .filter((one) => picked.has(one.code))
      .map((one) => one.displayName)
      .join(', ');
  });

  /** Nhung gi khung ba chieu can de ve de, cap nhat ngay khi go chu khac. */
  readonly standView = computed<StandView | null>(() => {
    const choice = this.facade.stand();
    const shape = shapeOfBase(choice.baseCode);
    if (!shape) {
      return null;
    }
    const value = this.engraving();
    return {
      shape,
      tone: STAND_TONES.find((one) => one.code === choice.tone) ?? STAND_TONES[0],
      decorations: choice.decorations,
      name: (value.engravedName ?? '').trim(),
      line: dateForStand(value.memorialDate ?? ''),
    };
  });

  /** Gia them cua de dang chon, hien rieng o buoc goi qua. */
  /** Hai nhom hop va khung, moi nhom kem lua chon khong lay. Nhom chua co mau nao thi an. */
  readonly packGroups = computed(() => {
    const picked = this.facade.packagingPicked();
    return PACK_GROUPS.map((group) => ({
      ...group,
      none: !picked[group.kind],
      options: this.facade
        .packagingCatalog()
        .filter((one) => one.kind === group.kind)
        .map((raw) => ({ raw, on: picked[group.kind] === raw.code, free: isZero(raw.priceDelta.$numberDecimal) })),
    })).filter((group) => group.options.length > 0);
  });

  /** Ten hop va khung dang chon, de ghi vao bang gia. */
  readonly packagingNames = computed(() => {
    const picked = new Set(this.facade.packagingCodes());
    return this.facade
      .packagingCatalog()
      .filter((one) => picked.has(one.code))
      .map((one) => one.displayName)
      .join(', ');
  });

  readonly baseLine = computed(() => {
    const base = this.facade.baseChosen();
    if (!base || !this.hasStand()) {
      return null;
    }
    return { name: base.displayName, price: base.priceDelta, currency: base.currency, free: isZero(base.priceDelta.$numberDecimal) };
  });

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
    const query = this.route.snapshot.queryParamMap;
    const codeDraft = query.get('draft');
    // Tu trang san pham sang: chon san san pham, kich co va de khach vua chon.
    const product = query.get('product');
    if (!codeDraft && product) {
      this.facade.selectKind(product);
      const size = query.get('size');
      if (size) {
        this.facade.selectSize(size);
      }
      const base = query.get('base');
      if (base) {
        this.facade.selectBase(base);
      }
    }
    this.http
      .get<ModelLibrary>('/models/manifest.json')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (library) => {
          this.library = library;
          this.declaredZones = library.zoneMaterial;
          this.zoneByFile = library.zoneByFile ?? {};
          const ready = library.baseModel.filter((m) => m.ready);
          this.baseModel.set(ready);
          this.status.set(ready.length > 0 ? 'READY' : 'ERROR');
          if (codeDraft) {
            this.openDesign(codeDraft);
            return;
          }
          const first = ready.find((m) => m.pose === 'SITTING') ?? ready[0] ?? null;
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

  /** Mo mot ban thiet ke len san khau: chon dung mau nen va nap mau tung vung. */
  private openDesign(code: string, onOpened?: () => void): void {
    const library = this.library;
    if (!library) {
      return;
    }
    const ready = this.baseModel();
    this.facade.openDraft(code, (tk) => {
      const modelCode = currentModelCode(tk.modelCode, library);
      this.baseModelSelected.set(ready.find((m) => m.code === modelCode) ?? ready[0] ?? null);
      this.colorCodesUsed.set([...tk.colorCodesUsed]);
      this.zonePaintOpened.set(tk.paint.length === 0 ? (tk.zonePaint ?? []) : []);
      onOpened?.();
    });
  }

  /** Dung san mau tu anh cua be va mo mau do len ngay trong buoc chon mau. */
  matchFromPhoto(): void {
    this.facade.matchFromPhoto((designId) => this.openDesign(designId));
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

  selectPose(pose: string): void {
    this.poseSelected.set(this.poseSelected() === pose ? null : pose);
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
    if ((model.anchors ?? []).length === 0) {
      this.facade.clearAccessories();
    }
    this.nameDraftFor(model);
  }

  toggleAccessory(code: string): void {
    const done = this.facade.toggleAccessory(code);
    this.accessoryNote.set(done ? null : 'STUDIO.ACC.FULL');
    // Phu kien doi thi anh sau goc cu khong con dung, lan sang ngan hoan tat se chup lai.
    this.preview.set([]);
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

  saveDraft(onSaved?: () => void): void {
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
      onSaved,
    );
  }

  /**
   * Them vao gio.
   *
   * Nut luon bam duoc. Con thieu dieu kien thi hien danh sach ly do, moi ly do
   * kem nut dua ve dung buoc can sua. Ban thiet ke chua luu hay vua doi thi tu
   * luu truoc roi moi them, khach khong phai nho bam luu.
   */
  addToCart(): void {
    this.cartTried.set(true);
    if (this.facade.cartBlockers().length > 0) {
      this.facade.form.controls.name.markAsTouched();
      return;
    }
    const petName = this.facade.form.getRawValue().engravedName.trim();
    if (this.facade.designId() === null || this.facade.standDirty()) {
      this.saveDraft(() => this.facade.addToCart(petName));
      return;
    }
    this.facade.addToCart(petName);
  }

  /** Da bam them vao gio it nhat mot lan, tu do moi hien ly do con thieu. */
  private readonly cartTried = signal(false);

  /** Ly do chua them duoc vao gio, cap nhat ngay khi khach sua xong tung muc. */
  readonly cartProblems = computed(() => (this.cartTried() ? this.facade.cartBlockers() : []));

  /** Nut them vao gio chi khoa trong luc dang luu hoac dang gui. */
  readonly cartBusy = computed(() => this.facade.statusSave() === 'SAVING' || this.facade.addingToCart());

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

  /**
   * Mau cua tung vung co ten tren mo hinh dang dung, cho ho so san xuat.
   *
   * Dem mau tren cac mat da to cua tung vat lieu va lay mau len xuat hien nhieu
   * nhat. Mau goc cua tep khong trung ma len nao nen tu bi bo qua: vung nao
   * khach chua chon mau thi khong ghi.
   */
  private zonePaintOf(model: BaseModel): { zone: string; colorCode: string }[] {
    const map = this.zoneByFile[model.file] ?? {};
    const codeOf = new Map(this.palette().map((one) => [one.swatch.replace('#', '').toLowerCase(), one.code]));
    const counts = this.viewer()?.readColorCountByMaterial() ?? {};
    const best = new Map<string, { code: string; faces: number }>();
    for (const [material, byColor] of Object.entries(counts)) {
      const zone = map[material];
      if (!zone) {
        continue;
      }
      for (const [hex, faces] of Object.entries(byColor)) {
        const code = codeOf.get(hex.toLowerCase());
        const now = best.get(zone);
        if (code && (!now || faces > now.faces)) {
          best.set(zone, { code, faces });
        }
      }
    }
    return [...best].map(([zone, one]) => ({ zone, colorCode: one.code }));
  }
}
