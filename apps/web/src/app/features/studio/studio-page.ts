import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { DateInput } from '../../shared/date-input/date-input';
import { Icon } from '../../shared/icon/icon';
import { Viewer3d } from '../../shared/viewer-3d/viewer-3d';
import { FRAME_FINISHES, FRAME_SHAPES, FrameFinish, FrameShape, HoopPreview } from '../../shared/hoop-preview/hoop-preview';
import { MoneyPipe } from '../../shared/money.pipe';
import { StudioFacade } from './studio-facade';
import { ANCHOR_NODE, AccessoryMount, StandardAngle, MaterialZone } from '../../shared/viewer-3d/engine-3d';
import { PaintMode } from '../../shared/viewer-3d/painter';
import { CatalogService } from '../../core/services/catalog.service';
import { PackagingKind, PhotoMatchInfo, PreviewAngle, ColorCode, ZonePaint } from '../../core/models/api.model';
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
/** Nhom dong goi chon o buoc cuoi. Loai khung da chuyen len buoc Khung & ten nen o day chi con hop. */
const PACK_GROUPS: { kind: PackagingKind; key: string }[] = [{ kind: 'BOX', key: 'STUDIO.PACK.BOX' }];

function isZero(value: string): boolean {
  return /^0+(\.0+)?$/.test(value.trim());
}

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

/** Thoi gian ngan treo khung theu truot ra/vao (ms); khop voi transition .hoop-wall trong scss. */
const HOOP_SLIDE_MS = 650;

/** Bon ngan do nghe cua ban len, theo thu tu nguoi dung di qua. */
export type Step = 'MODEL' | 'COLOR' | 'PHOTOS' | 'SHOWCASE' | 'FINISH';

/**
 * Thu tu cac buoc. Dung mau tu anh la tuy chon, nam gon trong buoc chon mau:
 * khach nop anh de he thong tu chon mau, hoac tu chon lay.
 */
export const STEPS: Step[] = ['MODEL', 'COLOR', 'PHOTOS', 'SHOWCASE', 'FINISH'];

/** Nhan va bieu tuong cua tung ngan, viet ra tung key de tim duoc. */
const STEP_VIEW: Record<Step, { key: string; icon: string }> = {
  MODEL: { key: 'STUDIO.TAB.MODEL', icon: 'paw' },
  COLOR: { key: 'STUDIO.TAB.COLOR', icon: 'sparkle' },
  PHOTOS: { key: 'STUDIO.TAB.PHOTOS', icon: 'camera' },
  SHOWCASE: { key: 'STUDIO.TAB.SHOWCASE', icon: 'star' },
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
  HEAD: 'STUDIO.POSE.HEAD',
};

/**
 * Doc mot lua chon xem truoc da luu tren may nay, chi nhan gia tri nam trong danh sach.
 * Bo nho trinh duyet co the bi chan (che do an danh), khi do dung mac dinh.
 */
function readPreference<T extends string>(name: string, allowed: readonly T[]): T | null {
  try {
    const value = localStorage.getItem(`pm-studio-${name}`);
    return allowed.includes(value as T) ? (value as T) : null;
  } catch {
    return null;
  }
}

function writePreference(name: string, value: string): void {
  try {
    localStorage.setItem(`pm-studio-${name}`, value);
  } catch {
    // Khong luu duoc thi lan sau dung lai mac dinh, khong anh huong gi khac.
  }
}

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
import { CUSTOM_KEEPSAKE_CODES, FIGURE_PRODUCT_CODE, PORTRAIT_PRODUCT_CODE, packagingFits } from '../catalog/custom-keepsakes';
import { FinishedShowcase } from './finished-showcase/finished-showcase';
import { GuideStep, StudioGuide } from './guide/studio-guide';

@Component({
  selector: 'pm-studio-page',
  standalone: true,
  imports: [Icon, Viewer3d, HoopPreview, FinishedShowcase, StudioGuide, RouterLink, ReactiveFormsModule, MoneyPipe, MatProgressSpinnerModule, TranslatePipe, DatePipe, PetPhotos, DateInput],
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

  /** Anh be nhin thang, nen trong suot, dat vao khung theu xem truoc thanh pham. */
  readonly portrait = signal<string | null>(null);
  private portraitTimers: ReturnType<typeof setTimeout>[] = [];

  /** Khung de uom: mau nao cung xem duoc be nam trong khung, de hinh dung truoc khi chon loai khung. */
  readonly hoopAvailable = computed(() => this.baseModelSelected() !== null);
  /** Nguoi dung tu an hoac hien khung xem truoc; nho lai cho lan sau tren may nay. */
  readonly hoopShown = signal(readPreference('hoop-shown', ['1', '0']) !== '0');
  readonly showHoop = computed(() => this.hoopAvailable() && this.hoopShown());
  /** Tren man hep khung thu nho o goc; cham vao thi mo to kem bo chon khung. */
  readonly hoopOpen = signal(false);
  readonly frameShape = signal<FrameShape>(readPreference('frame-shape', FRAME_SHAPES) ?? 'ROUND');
  readonly frameFinish = signal<FrameFinish>(readPreference('frame-finish', FRAME_FINISHES) ?? 'WALNUT');
  readonly frameShapes = FRAME_SHAPES.map((shape) => ({ shape, key: `STUDIO.HOOP.SHAPE.${shape}` }));
  readonly frameFinishes = FRAME_FINISHES.map((finish) => ({
    finish,
    key: `STUDIO.HOOP.FINISH.${finish}`,
    swatch: `var(--pm-frame-${finish.toLowerCase()})`,
  }));
  readonly finishKey = computed(() => `STUDIO.HOOP.FINISH.${this.frameFinish()}`);

  /**
   * Ngan treo khung theu truot ra/vao theo hai nhip: gan vao cay DOM truoc (o ngoai man hinh),
   * mot nhip sau moi them class .on de CSS truot vao; khi tat thi truot ra roi moi go khoi cay.
   */
  readonly hoopMounted = signal(false);
  readonly hoopOn = signal(false);
  private hoopTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly hoopSlide = effect(() => {
    const want = this.showHoop();
    untracked(() => {
      if (this.hoopTimer) {
        clearTimeout(this.hoopTimer);
      }
      if (want) {
        this.hoopMounted.set(true);
        this.hoopTimer = setTimeout(() => this.hoopOn.set(true), 50);
      } else {
        this.hoopOn.set(false);
        this.hoopTimer = setTimeout(() => this.hoopMounted.set(false), HOOP_SLIDE_MS);
      }
    });
  });

  /**
   * Doi phu kien hay mau theo vung thi chup lai; tep phu kien nap cham nen chup them mot lan sau.
   * Lan chup dau doi den khi ngan treo truot xong, vi chup anh la viec nang va se lam khung hinh.
   */
  protected readonly hoopOnChange = effect(() => {
    this.accessoryMounts();
    this.colorByZone();
    this.showHoop();
    untracked(() => this.schedulePortrait([HOOP_SLIDE_MS + 150, HOOP_SLIDE_MS + 1300]));
  });

  private readonly stopPortraitTimers = this.destroyRef.onDestroy(() => {
    for (const timer of this.portraitTimers) {
      clearTimeout(timer);
    }
    if (this.hoopTimer) {
      clearTimeout(this.hoopTimer);
    }
  });

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
  readonly portraitSelected = computed(() => this.facade.codeKindSelected() === PORTRAIT_PRODUCT_CODE);
  /**
   * San pham do khach chu dong chon (tu trang san pham sang, hoac bam chon) thi gioi
   * han danh sach mau theo san pham do. San pham tu chon theo mau thi khong gioi han,
   * neu khong khach se khong doi duoc tu mau nguyen con sang mau chi dau.
   */
  private readonly productPinned = signal(false);

  readonly availableModels = computed(() => {
    const product = this.productPinned() ? this.facade.codeKindSelected() : '';
    return this.baseModel().filter((model) => model.pose === 'HEAD' && (!product || product === PORTRAIT_PRODUCT_CODE));
  });

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
    return STEPS.map((code, i) => ({
      code,
      ...STEP_VIEW[code],
      on: code === now,
      done: i < at,
      number: i + 1,
      // Buoc anh la bat buoc de dat hang: nhac bang cham do cho den khi du anh.
      todo: code === 'PHOTOS' && code !== now && !this.facade.photosReady(),
    }));
  });

  readonly stepCount = STEPS.length;

  /** Lop huong dan: tu mo lan dau vao trang, sau do mo lai bang nut Huong dan. */
  /** So lan kich hoat man ra mat o buoc Thanh pham. */
  readonly showcaseRevealTrigger = signal<number>(0);

  readonly guideOpen = signal(false);

  /** Cac diem nhan cua huong dan; muc giai thich o ngan keo doi noi dung theo buoc dang mo. */
  readonly guideSteps = computed<GuideStep[]>(() => [
    { target: '.stage', titleKey: 'STUDIO.GUIDE.STAGE_TITLE', bodyKey: 'STUDIO.GUIDE.STAGE_BODY' },
    { target: '.stage-tools', titleKey: 'STUDIO.GUIDE.TOOLS_TITLE', bodyKey: 'STUDIO.GUIDE.TOOLS_BODY' },
    { target: '.stepper', titleKey: 'STUDIO.GUIDE.STEPS_TITLE', bodyKey: 'STUDIO.GUIDE.STEPS_BODY' },
    { target: '.panel-head', titleKey: 'STUDIO.GUIDE.PANEL_TITLE', bodyKey: 'STUDIO.HELP.' + this.step() },
    { target: '.drawer-foot', titleKey: 'STUDIO.GUIDE.FOOT_TITLE', bodyKey: 'STUDIO.GUIDE.FOOT_BODY' },
    { target: '.guide-btn', titleKey: 'STUDIO.GUIDE.REOPEN_TITLE', bodyKey: 'STUDIO.GUIDE.REOPEN_BODY' },
  ]);

  openGuide(): void {
    this.guideOpen.set(true);
  }

  /** Dong huong dan va nho da xem, lan sau vao trang khong tu mo nua. */
  closeGuide(): void {
    this.guideOpen.set(false);
    writePreference('guide-seen', '1');
  }

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
    const kinds = [...new Set(this.availableModels().map((m) => m.kind))];
    return kinds.map((kind) => ({ kind, key: KEY_KIND[kind] ?? 'STUDIO.KIND.OTHER' }));
  });

  /** Cac dang co trong thu vien, de loc theo dang (ngoi, dung, nam). */
  readonly poseTabs = computed(() => {
    const poses = [...new Set(this.availableModels().map((m) => m.pose))].filter((pose) => KEY_POSE[pose]);
    return poses.map((pose) => ({ pose, key: KEY_POSE[pose], on: this.poseSelected() === pose }));
  });

  /** The mau nen sau khi loc theo loai va dang, kem hinh minh hoa va nhan dang. */
  readonly modelCards = computed(() => {
    const kind = this.kindSelected();
    const pose = this.poseSelected();
    const chosen = this.baseModelSelected()?.code;
    return this.availableModels()
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
  /** Mau WebAR gan nhat voi mo hinh dang chon, de trang AR mo san dung con. */
  readonly arModel = computed(() => {
    const code = (this.baseModelSelected()?.code ?? '').toLowerCase();
    if (code.includes('husky')) return 'husky';
    if (code.includes('fox')) return 'fox';
    if (code.includes('bunny') || code.includes('cat')) return 'bunny';
    return 'shiba';
  });

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
  // Khach khong con tu them phu kien; ban nhap cu da co phu kien van hien va tinh gia nhu cu.

  /** Mau dang chon co diem neo thi moi gan duoc phu kien. */
  readonly canAccessorize = computed(() => (this.baseModelSelected()?.anchors ?? []).length > 0);
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
    const product = this.facade.codeKindSelected();
    return PACK_GROUPS.map((group) => ({
      ...group,
      none: !picked[group.kind],
      // Chi hien bao bi hop voi san pham dang chon: long mica cho tuong, khung treo tuong cho tranh.
      options: this.facade
        .packagingCatalog()
        .filter((one) => one.kind === group.kind && packagingFits(one.code, product))
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

  /**
   * San pham hop voi mau dang chon: mau chi dau lam tranh len choc noi, mau nguyen
   * con lam tuong. Chua chon mau thi rong, de khach tu chon san pham truoc.
   */
  readonly productForModel = computed(() => {
    const model = this.baseModelSelected();
    if (!model) {
      return null;
    }
    return model.pose === 'HEAD' ? PORTRAIT_PRODUCT_CODE : FIGURE_PRODUCT_CODE;
  });

  /** Chi hien san pham hop voi mau dang chon, nen kich co va tuy chon cung dung loai. */
  readonly productCards = computed(() => {
    const only = this.productForModel();
    return this.facade
      .types()
      .filter((kind) => CUSTOM_KEEPSAKE_CODES.has(kind.code) && (!only || kind.code === only))
      .map((kind) => ({
        raw: kind,
        on: this.facade.codeKindSelected() === kind.code,
      }));
  });

  /**
   * Doi mau thi tu chon san pham tuong ung. Da dung loai san (nhu mo lai ban thiet
   * ke da luu) thi khong cham, de khong mat kich co da chon.
   */
  /** Doi san pham thi bo bao bi khong con hop (vi du long mica khi chuyen sang tranh). */
  protected readonly packagingFollowsProduct = effect(() => {
    const product = this.facade.codeKindSelected();
    const picked = this.facade.packagingPicked();
    for (const [kind, code] of Object.entries(picked)) {
      if (code && !packagingFits(code, product)) {
        untracked(() => this.facade.selectPackaging(kind as PackagingKind, ''));
      }
    }
  });

  protected readonly productFollowsModel = effect(() => {
    const want = this.productForModel();
    const loaded = this.facade.types().some((kind) => kind.code === want);
    if (!want || !loaded || this.facade.codeKindSelected() === want) {
      return;
    }
    untracked(() => this.facade.selectKind(want));
  });

  /**
   * Chon san mot co (co vua neu co) ngay khi biet san pham, de gia tam tinh hien tu buoc dau
   * va so phu kien duoc gan co san. Da co co roi (mo ban nhap, tu trang san pham) thi khong dong den.
   */
  protected readonly sizeDefault = effect(() => {
    const sizes = this.facade.sizes();
    const kind = this.facade.codeKindSelected();
    if (kind && sizes.length > 0 && !this.facade.sizeCodeSelected()) {
      untracked(() => this.facade.selectSize(sizes[Math.min(1, sizes.length - 1)].code));
    }
  });

  readonly sizeCards = computed(() =>
    this.facade.sizes().map((size) => ({ raw: size, on: this.facade.sizeCodeSelected() === size.code })),
  );

  /** Trang thai nut cua san khau, doc thang tu khung 3D. */
  readonly rotating = computed(() => this.viewer()?.autoRotate() ?? true);
  readonly angleNow = computed(() => this.viewer()?.angleSelected() ?? 'ISO');

  ngOnInit(): void {
    this.facade.loadCatalog();
    this.facade.loadPets();
    this.facade.watchDetails();
    this.facade.selectKind(PORTRAIT_PRODUCT_CODE);
    this.productPinned.set(true);
    const query = this.route.snapshot.queryParamMap;
    const codeDraft = query.get('draft');
    if (codeDraft) this.productPinned.set(false);
    // Tu trang san pham sang: chon san san pham, kich co va de khach vua chon.
    const product = query.get('product');
    if (!codeDraft && product) {
      this.facade.selectKind(product);
      this.productPinned.set(true);
      const size = query.get('size');
      if (size) {
        this.facade.selectSize(size);
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
          const ready = library.baseModel.filter((m) => m.ready && m.pose === 'HEAD');
          this.baseModel.set(ready);
          this.status.set(ready.length > 0 ? 'READY' : 'ERROR');
          // Lan dau vao trang: tu mo huong dan sau khi be 3D hien ra mot nhip.
          if (ready.length > 0 && !codeDraft && readPreference('guide-seen', ['1']) !== '1') {
            setTimeout(() => this.guideOpen.set(true), 900);
          }
          if (codeDraft) {
            this.openDesign(codeDraft);
            return;
          }
          const first = this.availableModels()[0] ?? null;
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
  private openDesign(code: string): void {
    const library = this.library;
    if (!library) {
      return;
    }
    const ready = this.baseModel();
    this.facade.openDraft(code, (tk) => {
      if (FRAME_SHAPES.includes(tk.frameShape as FrameShape)) this.frameShape.set(tk.frameShape as FrameShape);
      if (FRAME_FINISHES.includes(tk.frameFinish as FrameFinish)) this.frameFinish.set(tk.frameFinish as FrameFinish);
      const modelCode = currentModelCode(tk.modelCode, library);
      this.baseModelSelected.set(ready.find((m) => m.code === modelCode) ?? ready[0] ?? null);
      this.colorCodesUsed.set([...tk.colorCodesUsed]);
      this.zonePaintOpened.set(tk.paint.length === 0 ? (tk.zonePaint ?? []) : []);
    });
  }

  /**
   * Dung san mau tu anh cua be va ap ngay len ban dang lam: doi mau nen va to mau
   * tung vung. Chua luu gi; khach bam Luu thi moi thanh mot ban thiet ke.
   */
  matchFromPhoto(): void {
    this.facade.matchFromPhoto(
      (match) => this.applyMatch(match),
      this.facade.codeKindSelected() === PORTRAIT_PRODUCT_CODE ? 'HEAD' : undefined,
    );
  }

  /** Tai thang mot anh len de goi y mau, khong can chon be trong ho so. */
  matchFromUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      void this.facade.matchFromUpload(
        file,
        this.kindSelected() ?? '',
        (match) => this.applyMatch(match),
        this.facade.codeKindSelected() === PORTRAIT_PRODUCT_CODE ? 'HEAD' : undefined,
      );
    }
  }

  uploadReference(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.facade.uploadReference(file);
  }

  private applyMatch(match: PhotoMatchInfo): void {
    const library = this.library;
    const code = library ? currentModelCode(match.modelCode, library) : match.modelCode;
    const model = this.baseModel().find((one) => one.code === code);
    if (!model) {
      return;
    }
    this.baseModelSelected.set(model);
    this.zoneDisplay.set([]);
    this.colorPendingPaint.set(null);
    this.preview.set([]);
    this.facade.paintSaved.set([]);
    if ((model.anchors ?? []).length === 0) {
      this.facade.clearAccessories();
    }
    this.colorCodesUsed.set([...new Set(match.zonePaint.map((one) => one.colorCode))]);
    this.zonePaintOpened.set([...match.zonePaint]);
    this.nameDraftFor(model);
  }

  go(step: Step): void {
    this.step.set(step);
    // Chuyen vao buoc thanh pham thi phat man chao don anh sang Out-In
    if (step === 'SHOWCASE') {
      this.showcaseRevealTrigger.update((v) => v + 1);
    }
    // Sang ngan hoan tat ma chua co anh thi tu chup sau goc, de khoi phai nho bam.
    if (step === 'FINISH' && this.preview().length === 0) {
      this.capture();
    }
    this.colorPendingPaint.set(null);
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

  selectProduct(code: string): void {
    this.facade.selectKind(code);
    this.productPinned.set(true);
    this.kindSelected.set(null);
    this.poseSelected.set(null);
    const selected = this.baseModelSelected();
    if (selected && !this.availableModels().some((model) => model.code === selected.code)) {
      const first = this.availableModels()[0];
      if (first) {
        this.selectBaseModel(first);
      }
    }
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

  recordPainted(swatch: string): void {
    const code = this.palette().find((m) => m.swatch.toLowerCase() === swatch.toLowerCase())?.code;
    if (!code) {
      return;
    }
    this.colorCodesUsed.update((ds) => (ds.includes(code) ? ds : [...ds, code]));
    // Mau da doi thi bo anh cu, lan sang ngan hoan tat se chup lai.
    this.preview.set([]);
    this.schedulePortrait();
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
    this.schedulePortrait();
  }

  toggleHoop(): void {
    const shown = !this.hoopShown();
    this.hoopShown.set(shown);
    this.hoopOpen.set(false);
    writePreference('hoop-shown', shown ? '1' : '0');
  }

  pickFrameShape(shape: FrameShape): void {
    this.showFramePreview();
    this.frameShape.set(shape);
    this.facade.markDesignChanged();
    writePreference('frame-shape', shape);
  }

  pickFrameFinish(finish: FrameFinish): void {
    this.showFramePreview();
    this.frameFinish.set(finish);
    this.facade.markDesignChanged();
    writePreference('frame-finish', finish);
  }

  /** Dang an khung xem truoc ma chon mau khung thi hien lai, khong thi chon ma khong thay gi. */
  private showFramePreview(): void {
    if (!this.hoopShown()) {
      this.toggleHoop();
    }
  }

  /** Mau vua nap xong (ca mau da to cua ban nhap), chup anh cho khung theu. */
  onViewerReady(): void {
    this.portrait.set(null);
    // Doi ngan treo truot xong roi moi chup, de khong chup giua luc dang chuyen dong.
    this.schedulePortrait([this.hoopOn() ? 150 : HOOP_SLIDE_MS + 150]);
  }

  /**
   * Hen chup lai anh cho khung theu.
   *
   * Keo co to thi moi cham ban mot lan, nen gom lai: lan hen sau xoa lan truoc,
   * chi chup khi tay da dung. Khong phai mau dau thi khong chup.
   */
  private schedulePortrait(delays = [350]): void {
    for (const timer of this.portraitTimers) {
      clearTimeout(timer);
    }
    this.portraitTimers = delays.map((delay) =>
      setTimeout(() => {
        if (this.showHoop()) {
          this.portrait.set(this.viewer()?.capturePortrait() ?? null);
        }
      }, delay),
    );
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
      { shape: this.frameShape(), finish: this.frameFinish() },
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
  readonly cartBusy = computed(() => this.facade.statusSave() === 'SAVING' || this.facade.addingToCart() || this.facade.uploadingReference() || this.facade.referencesLoading());

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
