import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Viewer3d } from '../../shared/viewer-3d/viewer-3d';
import { MaterialZone } from '../../shared/viewer-3d/engine-3d';
import { BaseModel, ModelLibrary } from '../studio/model-manifest';

type ScreenState = 'LOADING' | 'READY' | 'ERROR';

/** Trang thai man hinh luc dang doc du lieu. */
const LOADING = 'LOADING';

/** Duong dan tep danh muc mo hinh. */
const MANIFEST = '/models/manifest.json';

/** Nhom dang mac dinh khi tep danh muc khong ghi. */
const GROUP_FALLBACK = 'BLOCKY';

/**
 * Ba nhom dang, kem key ban dich.
 *
 * Viet ra tung key mot de tim duoc bang tim kiem chu, khong ghep key tu chuoi.
 */
const GROUPS: { group: string; key: string; noteKey: string }[] = [
  { group: 'FELTED', key: 'STUDIO.FELTED', noteKey: 'ADMIN.MODELS.NOTE_FELTED' },
  { group: 'REALISTIC', key: 'STUDIO.REALISTIC', noteKey: 'ADMIN.MODELS.NOTE_REALISTIC' },
  { group: GROUP_FALLBACK, key: 'STUDIO.BLOCKY', noteKey: 'ADMIN.MODELS.NOTE_BLOCKY' },
];

/**
 * Tra key ban dich cho tung loai thu.
 *
 * Khai ra tung key mot de tim duoc bang tim kiem chu.
 */
const KEY_KIND: Record<string, string> = {
  DOG: 'STUDIO.KIND.DOG',
  CAT: 'STUDIO.KIND.CAT',
  BIRD: 'STUDIO.KIND.BIRD',
  OTHER: 'STUDIO.KIND.OTHER',
};

/** Mot cot so sanh: mot nhom dang kem mau dang chon trong nhom do. */
interface ShapeColumn {
  group: string;
  key: string;
  noteKey: string;
  choices: BaseModel[];
  picked: BaseModel | null;
  path: string;
  shape: string;
  zoneCount: number;
  zoneText: string;
}

/**
 * So sanh cac mau 3D dang co.
 *
 * Man hinh nay de chon dang nao hop voi san pham len choc nhat. Chon mot loai
 * thu roi nhin ba dang cua no canh nhau: dang len, dang that va dang khoi.
 *
 * Moi cot la mot khung nhin thuc su, xoay duoc, doc dung tep mo hinh se dung
 * khi ban hang chu khong phai anh chup san. Chi mo ba khung mot luc, vi trinh
 * duyet chi cho mo mot so luong khung do hoa nhat dinh.
 *
 * Nhom nao khong co mau cho loai thu dang chon thi cot do noi thang la chua co,
 * de thay ngay cho con thieu.
 */
@Component({
  selector: 'pm-admin-models-page',
  standalone: true,
  imports: [TranslatePipe, Viewer3d],
  templateUrl: './admin-models-page.html',
  styleUrls: ['./admin-shared.scss', './admin-models-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminModelsPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>(LOADING);
  readonly models = signal<BaseModel[]>([]);

  /** Loai thu dang xem. */
  readonly kindShown = signal('DOG');

  /** Mau dang chon trong tung nhom, tra theo ten nhom. */
  readonly pickedByGroup = signal<Record<string, string>>({});

  /** So vung mau doc duoc cua tung mau, tra theo ma mau. */
  readonly zonesByCode = signal<Record<string, string[]>>({});

  /** Cac loai thu co mau, kem key ban dich. */
  readonly kindTabs = computed(() => {
    const kinds = [...new Set(this.models().map((one) => one.kind))];
    return kinds.map((kind) => ({ kind, key: KEY_KIND[kind] ?? KEY_KIND['OTHER'] }));
  });

  readonly columns = computed<ShapeColumn[]>(() => {
    const kind = this.kindShown();
    const chosen = this.pickedByGroup();
    const zones = this.zonesByCode();
    return GROUPS.map((one) => {
      const choices = this.models().filter(
        (m) => m.kind === kind && (m.styleGroup ?? GROUP_FALLBACK) === one.group,
      );
      const picked = choices.find((m) => m.code === chosen[one.group]) ?? choices[0] ?? null;
      const found = picked ? (zones[picked.code] ?? []) : [];
      return {
        ...one,
        choices,
        picked,
        path: picked ? `/models/${picked.file}` : '',
        shape: picked?.bodyShape ?? '',
        zoneCount: found.length,
        zoneText: found.join(' · '),
      };
    });
  });

  /** Bang liet ke toan bo mau, de doi chieu so lieu. */
  readonly allRows = computed(() =>
    this.models().map((one) => ({
      raw: one,
      group: one.styleGroup ?? GROUP_FALLBACK,
      kindKey: KEY_KIND[one.kind] ?? KEY_KIND['OTHER'],
      shape: one.bodyShape ?? '',
    })),
  );

  ngOnInit(): void {
    this.http
      .get<ModelLibrary>(MANIFEST)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (got) => {
          this.models.set((got.baseModel ?? []).filter((one) => one.ready));
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  pickKind(kind: string): void {
    this.kindShown.set(kind);
  }

  pickModel(group: string, code: string): void {
    this.pickedByGroup.update((all) => ({ ...all, [group]: code }));
  }

  /** Ghi lai cac vung mau doc duoc, de con so tren man hinh la so that cua tep. */
  noteZones(code: string, zones: MaterialZone[]): void {
    this.zonesByCode.update((all) => ({ ...all, [code]: zones.map((one) => one.name) }));
  }
}
