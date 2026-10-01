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
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { exhaustMap, Subject } from 'rxjs';
import { AiService } from '../../core/services/ai.service';
import { PetsService } from '../../core/services/pets.service';
import { CatalogService } from '../../core/services/catalog.service';
import {
  ColorCode,
  DesignSuggestion,
  Pet,
  SuggestOption,
  SuggestStyleChoice,
} from '../../core/models/api.model';
import { ModelLibrary, ZoneName } from './model-manifest';
import { Viewer3d } from '../../shared/viewer-3d/viewer-3d';
import { Icon } from '../../shared/icon/icon';

type ScreenState = 'LOADING' | 'READY' | 'ERROR';

/**
 * Tra key ban dich cho tung phong cach.
 *
 * Khai ra tung key mot de tim duoc bang tim kiem chu. Khong bao gio ghep
 * key tu chuoi.
 */
const KEY_STYLE: Record<string, string> = {
  TRUE_TO_LIFE: 'SUGGEST.STYLE.TRUE_TO_LIFE',
  SOFT: 'SUGGEST.STYLE.SOFT',
  VIVID: 'SUGGEST.STYLE.VIVID',
  PASTEL: 'SUGGEST.STYLE.PASTEL',
};

/** Tra key ban dich cho tung vung co ten. */
const KEY_ZONE: Record<string, string> = {
  MAIN_FUR: 'PET.ZONE.MAIN_FUR',
  BELLY_FUR: 'PET.ZONE.BELLY_FUR',
  EAR: 'PET.ZONE.EARS',
  TAIL: 'PET.ZONE.TAIL',
  EYE: 'PET.ZONE.EYES',
  NOSE: 'PET.ZONE.NOSE',
};

/** Mot phuong an da duoc chuan bi de ve len man hinh. */
interface OptionView {
  key: string;
  title: string;
  rationale: string;
  modelPath: string;
  /** Mau gan cho tung mang vat lieu cua tep mo hinh. */
  colorByZone: Record<string, string>;
  /** Cac vung va mau, viet ra cho nguoi doc. */
  zoneLine: { zoneKey: string; name: string; swatch: string; rendered: boolean }[];
  /** Co vung nao tep mo hinh chua tach rieng nen chua to duoc khong. */
  someUnrendered: boolean;
}

/**
 * Goi y thiet ke bang tri tue nhan tao, theo Phu luc 01 muc 15.
 *
 * Man hinh nhan mot be va mot phong cach, roi xin may chu de xuat toi da bon
 * phuong an. Moi phuong an duoc ve bang chinh mo hinh that trong thu vien,
 * to dung cac mau da de xuat, nen thu nguoi dung nhin thay la thu ho se nhan
 * duoc chu khong phai mot buc anh minh hoa.
 *
 * Chon mot phuong an thi he thong tao ban thiet ke tuong ung va mo sang buoc
 * tuy bien, dung nhu hop dong ghi.
 */
@Component({
  selector: 'pm-suggest-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, Viewer3d, Icon],
  templateUrl: './suggest-page.html',
  styleUrl: './suggest-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestPage implements OnInit {
  private readonly service = inject(AiService);
  private readonly pets = inject(PetsService);
  private readonly catalog = inject(CatalogService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Cac lan bam xin goi y, xep hang de bam nhanh hai lan khong goi hai lan. */
  private readonly asked = new Subject<void>();

  /** Cac lan bam chon phuong an, cung xep hang vi day la thao tac ghi. */
  private readonly chosen = new Subject<string>();

  readonly status = signal<ScreenState>('LOADING');
  readonly working = signal(false);
  readonly problem = signal('');

  readonly petList = signal<Pet[]>([]);
  readonly styleList = signal<SuggestStyleChoice[]>([]);
  readonly palette = signal<ColorCode[]>([]);
  readonly plan = signal<DesignSuggestion | null>(null);
  readonly quotaLeft = signal(-1);

  readonly petChosen = signal('');
  readonly styleChosen = signal('TRUE_TO_LIFE');

  /** Phuong an dang xem to, de man hinh khong phai ve bon mo hinh mot luc. */
  readonly shownKey = signal('');

  private zoneByFile: Record<string, Record<string, ZoneName>> = {};
  private fileOf: Record<string, string> = {};

  /** Cac phong cach kem key ban dich, tinh san de khung nhin khong goi ham. */
  readonly styles = computed(() =>
    this.styleList().map((one) => ({ key: one.key, textKey: KEY_STYLE[one.key] ?? one.key })),
  );

  readonly canAsk = computed(
    () => this.petChosen() !== '' && !this.working() && this.quotaLeft() !== 0,
  );

  /** Lan goi y nay do dich vu that tra ve hay do bo phuong an mau. */
  readonly bySample = computed(() => this.plan()?.mode === 'SAMPLE');

  /** Cac phuong an da chuan bi san de ve. */
  readonly options = computed<OptionView[]>(() => {
    const got = this.plan();
    if (!got) {
      return [];
    }
    const swatchOf = new Map(this.palette().map((one) => [one.code, one.swatch]));
    const nameOf = new Map(this.palette().map((one) => [one.code, one.displayName]));
    return got.option.map((one) => this.asView(one, swatchOf, nameOf));
  });

  /** Phuong an dang duoc xem to. */
  readonly shown = computed<OptionView | null>(
    () => this.options().find((one) => one.key === this.shownKey()) ?? this.options()[0] ?? null,
  );

  ngOnInit(): void {
    this.http
      .get<ModelLibrary>('/models/manifest.json')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (library) => {
          this.zoneByFile = library.zoneByFile ?? {};
          this.fileOf = Object.fromEntries(
            library.baseModel.filter((one) => one.ready).map((one) => [one.code, one.file]),
          );
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });

    this.pets.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.petList.set(rows);
        this.petChosen.set(rows[0]?._id ?? '');
      },
      error: () => this.problem.set('SUGGEST.ERROR_PETS'),
    });

    this.service.suggestStyles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (got) => this.styleList.set(got.style),
      error: () => this.problem.set('SUGGEST.ERROR_STYLES'),
    });

    this.catalog.color$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => this.palette.set(rows),
      error: () => this.palette.set([]),
    });

    this.readQuota();

    /*
     * Mot lan xin goi y ton mot luot han muc, nen hai lan bam lien tiep phai
     * chi thanh mot lan goi. Toan tu nay bo qua cac lan bam trong luc lan goi
     * truoc chua xong.
     */
    this.asked
      .pipe(
        exhaustMap(() => this.service.askSuggestion(this.petChosen(), this.styleChosen())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (got) => {
          this.working.set(false);
          this.plan.set(got);
          this.shownKey.set(got.option[0]?.key ?? '');
          this.readQuota();
        },
        error: (trouble: { status?: number }) => {
          this.working.set(false);
          this.problem.set(
            trouble?.status === 429 ? 'SUGGEST.ERROR_QUOTA' : 'SUGGEST.ERROR_ASK',
          );
          this.readQuota();
        },
      });

    this.chosen
      .pipe(
        exhaustMap((key) => this.service.chooseOption(this.plan()?.code ?? '', key)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (made) => {
          this.working.set(false);
          void this.router.navigate(['/studio'], { queryParams: { draft: made._id } });
        },
        error: () => {
          this.working.set(false);
          this.problem.set('SUGGEST.ERROR_CHOOSE');
        },
      });
  }

  ask(): void {
    if (!this.canAsk()) {
      return;
    }
    this.problem.set('');
    this.working.set(true);
    this.asked.next();
  }

  show(key: string): void {
    this.shownKey.set(key);
  }

  choose(key: string): void {
    if (this.working()) {
      return;
    }
    this.problem.set('');
    this.working.set(true);
    this.chosen.next(key);
  }

  private readQuota(): void {
    this.service.suggestQuota().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (got) => this.quotaLeft.set(got.left),
      error: () => this.quotaLeft.set(-1),
    });
  }

  /**
   * Chuan bi mot phuong an de ve.
   *
   * Doi chieu nguoc tu vung co ten sang ten mang vat lieu cua chinh tep mo
   * hinh, vi moi tep dat ten mang mot kieu con phuong an thi noi theo vung.
   */
  private asView(
    one: SuggestOption,
    swatchOf: Map<string, string>,
    nameOf: Map<string, string>,
  ): OptionView {
    const file = this.fileOf[one.modelCode] ?? '';
    const zoneOf = this.zoneByFile[file] ?? {};
    const colorByZone: Record<string, string> = {};
    for (const [material, zone] of Object.entries(zoneOf)) {
      const found = one.zonePaint.find((each) => each.zone === zone);
      const swatch = found ? swatchOf.get(found.colorCode) : undefined;
      if (swatch) {
        colorByZone[material] = swatch;
      }
    }
    /*
     * Vung nao tep mo hinh co tach rieng thi moi to len duoc.
     *
     * Mot so tep mo hinh hien co chua tach rieng tai va duoi. Danh dau ro
     * thay vi lang le bo di, de nguoi dung khong tuong mot mau da duoc to ma
     * that ra chua, va de xuong biet phan nao con phai lam tay.
     */
    const canShow = new Set(Object.values(zoneOf));
    const zoneLine = one.zonePaint.map((each) => ({
      zoneKey: KEY_ZONE[each.zone] ?? each.zone,
      name: nameOf.get(each.colorCode) ?? each.colorCode,
      swatch: swatchOf.get(each.colorCode) ?? '#cccccc',
      rendered: canShow.has(each.zone as ZoneName),
    }));

    return {
      key: one.key,
      title: one.title,
      rationale: one.rationale,
      modelPath: file ? `/models/${file}` : '',
      colorByZone,
      zoneLine,
      someUnrendered: zoneLine.some((each) => !each.rendered),
    };
  }
}
