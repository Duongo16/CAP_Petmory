import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { fromEvent } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { Icon } from '../../shared/icon/icon';
import { GuestHeader } from '../../shared/guest-header/guest-header';
import { FooterLink, SiteFooter } from '../../shared/site-footer/site-footer';
import '@google/model-viewer';

export interface PetArModel {
  id: string;
  /** Khoa dich ten mau. */
  key: string;
  kind: string;
  /** Khoa dich kieu van dong noi bat cua mau. */
  motionKey: string;
  file: string;
  animations: {
    key: string;
    labelKey: string;
  }[];
}

/** Bo hoat anh chung cua cac mau tu goi AnimalArmature. */
const ARMATURE_ANIMATIONS = [
  { key: 'AnimalArmature|Gallop', labelKey: 'AR.ANIM.GALLOP' },
  { key: 'AnimalArmature|Walk', labelKey: 'AR.ANIM.WALK' },
  { key: 'AnimalArmature|Idle', labelKey: 'AR.ANIM.IDLE' },
  { key: 'AnimalArmature|Jump_ToIdle', labelKey: 'AR.ANIM.JUMP' },
];

export const AR_PET_MODELS: PetArModel[] = [
  {
    id: 'shiba',
    key: 'AR.MODEL.SHIBA',
    kind: 'DOG',
    motionKey: 'AR.MOTION.GALLOP',
    file: '/models/q-ShibaInu.glb',
    animations: [...ARMATURE_ANIMATIONS, { key: 'AnimalArmature|Eating', labelKey: 'AR.ANIM.EAT' }],
  },
  {
    id: 'husky',
    key: 'AR.MODEL.HUSKY',
    kind: 'DOG',
    motionKey: 'AR.MOTION.GALLOP',
    file: '/models/q-Husky.glb',
    animations: [...ARMATURE_ANIMATIONS, { key: 'AnimalArmature|Eating', labelKey: 'AR.ANIM.EAT' }],
  },
  {
    id: 'fox',
    key: 'AR.MODEL.FOX',
    kind: 'OTHER',
    motionKey: 'AR.MOTION.GALLOP',
    file: '/models/q-Fox.glb',
    animations: ARMATURE_ANIMATIONS,
  },
  {
    id: 'bunny',
    key: 'AR.MODEL.BUNNY',
    kind: 'OTHER',
    motionKey: 'AR.MOTION.HOP',
    file: '/models/animal-bunny.glb',
    animations: [
      { key: 'run', labelKey: 'AR.ANIM.RUN' },
      { key: 'walk', labelKey: 'AR.ANIM.WALK' },
      { key: 'dance', labelKey: 'AR.ANIM.DANCE' },
      { key: 'idle', labelKey: 'AR.ANIM.IDLE' },
      { key: 'eat', labelKey: 'AR.ANIM.NIBBLE' },
    ],
  },
  {
    id: 'panda',
    key: 'AR.MODEL.PANDA',
    kind: 'OTHER',
    motionKey: 'AR.MOTION.HOP',
    file: '/models/animal-panda.glb',
    animations: [
      { key: 'run', labelKey: 'AR.ANIM.RUN' },
      { key: 'walk', labelKey: 'AR.ANIM.WALK' },
      { key: 'dance', labelKey: 'AR.ANIM.DANCE' },
      { key: 'idle', labelKey: 'AR.ANIM.IDLE' },
      { key: 'eat', labelKey: 'AR.ANIM.BAMBOO' },
    ],
  },
];

/** Cac muc phong to trong AR. */
export const AR_SCALES = [
  { value: 0.6, labelKey: 'AR.SIZE.SMALL' },
  { value: 1, labelKey: 'AR.SIZE.NORMAL' },
  { value: 1.5, labelKey: 'AR.SIZE.LARGE' },
];

/** Dau model-viewer de lai tren dia chi khi khong mo duoc Scene Viewer (ung dung Google). */
const NO_SCENE_VIEWER_HASH = '#model-viewer-no-ar-fallback';

/** Trinh duyet nhung trong ung dung chat, mang xa hoi: khong goi duoc AR cua he thong. */
const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|Instagram|Zalo|Line\/|; wv\)/i;
const MOBILE = /Android|iPhone|iPad|iPod/i;

/**
 * Ly do may nay khong mo duoc AR. model-viewer chi ghi canh bao vao console roi
 * im lang, nen trang phai noi ro de nguoi dung biet can doi sang dau.
 */
export function arBlockedReason(ua: string, secure: boolean): string {
  if (IN_APP_BROWSER.test(ua)) {
    return 'AR.WHY.IN_APP';
  }
  if (!MOBILE.test(ua)) {
    return 'AR.WHY.NEED_PHONE';
  }
  if (!secure) {
    return 'AR.WHY.NEED_HTTPS';
  }
  return 'AR.WHY.UNSUPPORTED';
}

@Component({
  selector: 'pm-ar-pet-page',
  standalone: true,
  imports: [RouterLink, Icon, TranslatePipe, GuestHeader, SiteFooter],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './ar-pet-page.html',
  styleUrls: ['./ar-pet-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArPetPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('modelViewerRef') modelViewerRef?: ElementRef;

  readonly petList = AR_PET_MODELS;
  readonly scales = AR_SCALES;
  readonly selectedPet = signal<PetArModel>(AR_PET_MODELS[0]);
  readonly currentAnimation = signal<string>(AR_PET_MODELS[0].animations[0].key);
  readonly currentScale = signal<number>(1);
  /** Khoa dich ly do khong mo duoc AR; rong la chua co van de gi. */
  readonly arProblem = signal<string>('');
  readonly signedIn = inject(AuthService).isSignedIn;
  readonly guestFooterMenu: FooterLink[] = [
    { path: '/shop', key: 'NAV.SHOP' },
    { path: '/diaries', key: 'NAV.PUBLIC_DIARIES' },
    { path: '/login', key: 'AUTH.SIGN_IN' },
    { path: '/register', key: 'LANDING.START_FREE' },
  ];

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const modelId = params['model'] || params['pet'];
      if (modelId) {
        const found = this.petList.find(
          (p) => p.id.toLowerCase() === String(modelId).toLowerCase(),
        );
        if (found) {
          this.selectPet(found);
        }
      }
    });
    // Scene Viewer khong mo duoc thi trinh duyet quay lai trang kem dau nay.
    fromEvent(window, 'hashchange')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (location.hash === NO_SCENE_VIEWER_HASH) {
          this.arProblem.set('AR.WHY.NO_SCENE_VIEWER');
        }
      });
  }

  /** Mo hinh tai xong: bao truoc neu may nay khong mo duoc AR. */
  onModelLoaded(): void {
    const viewer = this.modelViewerRef?.nativeElement;
    if (this.arProblem() === 'AR.WHY.LOAD_FAILED') {
      this.arProblem.set('');
    }
    if (this.arProblem()) {
      return;
    }
    // Trinh duyet trong Zalo, Facebook van bao mo duoc AR nhung lien ket mo
    // ung dung AR thuong bi chan, nen nhac doi trinh duyet ngay tu dau.
    if (IN_APP_BROWSER.test(navigator.userAgent)) {
      this.arProblem.set('AR.WHY.IN_APP');
    } else if (viewer && !viewer.canActivateAR) {
      this.arProblem.set(arBlockedReason(navigator.userAgent, window.isSecureContext));
    }
  }

  onArStatus(event: Event): void {
    if ((event as CustomEvent<{ status: string }>).detail?.status === 'failed') {
      this.arProblem.set('AR.WHY.FAILED');
    }
  }

  selectPet(pet: PetArModel): void {
    this.selectedPet.set(pet);
    // Tự động chọn animation đầu tiên (chạy nước đại / run)
    if (pet.animations.length > 0) {
      this.currentAnimation.set(pet.animations[0].key);
    }
  }

  /** Nhan cua hoat anh dang chay, de hien tren khung xem. */
  animationLabel(): string {
    return (
      this.selectedPet().animations.find((a) => a.key === this.currentAnimation())?.labelKey ?? ''
    );
  }

  selectAnimation(animKey: string): void {
    this.currentAnimation.set(animKey);
    const viewer = this.modelViewerRef?.nativeElement;
    if (viewer) {
      viewer.animationName = animKey;
      viewer.play();
    }
  }

  scaleAttr(): string {
    const s = this.currentScale();
    return `${s} ${s} ${s}`;
  }

  setScale(scaleMultiplier: number): void {
    this.currentScale.set(scaleMultiplier);
    const viewer = this.modelViewerRef?.nativeElement;
    if (viewer) {
      viewer.scale = this.scaleAttr();
    }
  }

  /** Phai goi ngay trong luot bam: Scene Viewer va Quick Look can thao tac cua nguoi dung. */
  launchAr(): void {
    const viewer = this.modelViewerRef?.nativeElement;
    if (!viewer) {
      return;
    }
    if (!viewer.canActivateAR) {
      this.arProblem.set(arBlockedReason(navigator.userAgent, window.isSecureContext));
      return;
    }
    // Van thu mo; trong trinh duyet nhung thi giu loi nhac doi trinh duyet.
    this.arProblem.set(IN_APP_BROWSER.test(navigator.userAgent) ? 'AR.WHY.IN_APP' : '');
    Promise.resolve(viewer.activateAR()).catch(() => this.arProblem.set('AR.WHY.FAILED'));
  }
}
