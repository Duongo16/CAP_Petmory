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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminService } from '../../core/services/admin.service';
import { ProductionFile } from '../../core/models/api.model';
import { KEY_STATUS_ORDER } from '../../shared/order-status';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

/** Translation key lookup, declared explicitly so every key stays greppable. */
const KEY_MISSING: Record<string, string> = {
  NO_DESIGN: 'ADMIN.PROFILE.NO_DESIGN',
  NO_COLOR_CODES: 'ADMIN.PROFILE.NO_COLOR_CODES',
  NO_PREVIEWS: 'ADMIN.PROFILE.NO_PREVIEWS',
};

const KEY_MISSING_OTHER = 'ADMIN.PROFILE.OTHER_MISSING';

const KEY_ANGLE: Record<string, string> = {
  FRONT: 'VIEWER.ANGLE.FRONT',
  LEFT: 'VIEWER.ANGLE.LEFT',
  RIGHT: 'VIEWER.ANGLE.RIGHT',
  BACK: 'VIEWER.ANGLE.BACK',
  TOP: 'VIEWER.ANGLE.TOP',
  ISO: 'VIEWER.ANGLE.ISO',
};

/** Ten hien cua sau vung co ten, viet san de khong bao gio ghep chuoi. */
const ZONE_KEY: Record<string, string> = {
  MAIN_FUR: 'PET.ZONE.MAIN_FUR',
  BELLY_FUR: 'PET.ZONE.BELLY_FUR',
  EAR: 'PET.ZONE.EARS',
  TAIL: 'PET.ZONE.TAIL',
  EYE: 'PET.ZONE.EYES',
  NOSE: 'PET.ZONE.NOSE',
};

const ZONE_KEY_OTHER = 'ADMIN.PROFILE.ZONE_OTHER';

@Component({
  selector: 'pm-admin-production-page',
  standalone: true,
  imports: [RouterLink, DatePipe, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './admin-production-page.html',
  styleUrl: './admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductionPage implements OnInit {
  /**
   * Ten hien cua mot vung co ten.
   *
   * Vung la mot danh sach dong sau muc, nen bang tra duoc viet san va khoa
   * khong bao gio duoc ghep tu chuoi.
   */
  zoneKeyOf(zone: string): string {
    return ZONE_KEY[zone] ?? ZONE_KEY_OTHER;
  }

  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(AdminService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly data = signal<ProductionFile | null>(null);

  /** Temporary object URL for a preview, created from the bytes already fetched. */
  readonly sourcePhoto = signal<Record<string, string>>({});
  readonly status = signal<ScreenState>('LOADING');
  readonly orderCode = signal('');

  readonly profile = computed(() => this.data());

  readonly keyStatus = computed(() => {
    const d = this.data();
    return d ? KEY_STATUS_ORDER[d.status] : '';
  });

  readonly missingItems = computed(() =>
    (this.data()?.missing ?? []).map((code) => KEY_MISSING[code] ?? KEY_MISSING_OTHER),
  );

  /** Each item carries its translation and image keys, so the view calls no functions. */
  readonly items = computed(() =>
    (this.data()?.items ?? []).map((m) => ({
      ...m,
      photos: m.anglesPreview.map((angle) => ({
        angle,
        key: KEY_ANGLE[angle] ?? angle,
        keyPhoto: `${m.designId}:${angle}`,
      })),
    })),
  );

  private readonly cleanup = this.destroyRef.onDestroy(() => {
    Object.values(this.sourcePhoto()).forEach((d) => URL.revokeObjectURL(d));
  });

  ngOnInit(): void {
    this.orderCode.set(this.route.snapshot.paramMap.get('orderCode') ?? '');
    this.reload();
  }

  reload(): void {
    this.status.set('LOADING');
    this.service
      .productionFile(this.orderCode())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.data.set(profile);
          this.status.set('READY');
          this.loadPreview(profile);
        },
        error: () => this.status.set('ERROR'),
      });
  }

  /**
   * The image goes through a permission-checked path, so it must be fetched with the
   * access token; the URL cannot be placed directly in an img tag.
   */
  private loadPreview(profile: ProductionFile): void {
    for (const item of profile.items) {
      if (!item.designId) {
        continue;
      }
      for (const angle of item.anglesPreview) {
        const key = `${item.designId}:${angle}`;
        this.http
          .get(this.service.pathPhotoDesign(item.designId, angle), { responseType: 'blob' })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (blob) =>
              this.sourcePhoto.update((old) => ({ ...old, [key]: URL.createObjectURL(blob) })),
            error: () => undefined,
          });
      }
    }
  }

  inRa(): void {
    window.print();
  }
}
