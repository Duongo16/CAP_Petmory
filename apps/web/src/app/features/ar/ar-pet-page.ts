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
  /**
   * Ban AR cua mo hinh (tools/build-ar-models.js): da thu ve co that cua mot be
   * va dat hoat anh mac dinh len dau, vi Scene Viewer doc thang tep nay.
   */
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
    file: '/models/q-ShibaInu.ar.glb',
    animations: [...ARMATURE_ANIMATIONS, { key: 'AnimalArmature|Eating', labelKey: 'AR.ANIM.EAT' }],
  },
  {
    id: 'husky',
    key: 'AR.MODEL.HUSKY',
    kind: 'DOG',
    motionKey: 'AR.MOTION.GALLOP',
    file: '/models/q-Husky.ar.glb',
    animations: [...ARMATURE_ANIMATIONS, { key: 'AnimalArmature|Eating', labelKey: 'AR.ANIM.EAT' }],
  },
  {
    id: 'fox',
    key: 'AR.MODEL.FOX',
    kind: 'OTHER',
    motionKey: 'AR.MOTION.GALLOP',
    file: '/models/q-Fox.ar.glb',
    animations: ARMATURE_ANIMATIONS,
  },
  {
    id: 'bunny',
    key: 'AR.MODEL.BUNNY',
    kind: 'OTHER',
    motionKey: 'AR.MOTION.HOP',
    file: '/models/animal-bunny.ar.glb',
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
    file: '/models/animal-panda.ar.glb',
    animations: [
      { key: 'run', labelKey: 'AR.ANIM.RUN' },
      { key: 'walk', labelKey: 'AR.ANIM.WALK' },
      { key: 'dance', labelKey: 'AR.ANIM.DANCE' },
      { key: 'idle', labelKey: 'AR.ANIM.IDLE' },
      { key: 'eat', labelKey: 'AR.ANIM.BAMBOO' },
    ],
  },
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

/**
 * iPhone va iPad. iPad doi moi bao minh la Mac nen phai xet them man cam ung.
 * Tren may Apple, AR di qua Quick Look: tep USDZ tu dung khong mang hoat anh
 * xuong nen be dung yen, va Quick Look khong cho chen nut rieng.
 */
function isApplePhone(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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
  @ViewChild('cameraVideo') cameraVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('cameraViewer') cameraViewer?: ElementRef;

  /** May Apple: nut xem qua camera dua len lam nut chinh, vi AR cua Apple de be dung yen. */
  readonly applePhone = isApplePhone();
  /** Che do xem qua camera: anh camera sau lam nen, be 3D chay nhay de len, co nut doi hoat dong. */
  readonly cameraOpen = signal(false);
  private stream: MediaStream | null = null;

  readonly petList = AR_PET_MODELS;
  readonly selectedPet = signal<PetArModel>(AR_PET_MODELS[0]);
  readonly currentAnimation = signal<string>(AR_PET_MODELS[0].animations[0].key);
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
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.key === 'Escape' && this.cameraOpen()) {
          this.closeCamera();
        }
      });
    this.destroyRef.onDestroy(() => this.stopStream());
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
    } else if (this.applePhone) {
      this.arProblem.set('AR.WHY.APPLE_STILL');
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
    for (const viewer of [this.modelViewerRef?.nativeElement, this.cameraViewer?.nativeElement]) {
      if (viewer) {
        viewer.animationName = animKey;
        viewer.play();
      }
    }
  }

  /**
   * Mo camera sau ngay tren trang va dat be 3D len tren.
   *
   * Khac AR that, be khong bam vao san, nhung chay duoc tren moi trinh duyet co
   * camera (ke ca iPhone) va giu duoc nut doi hoat dong. Trinh duyet chi cho
   * dung camera tren trang https.
   */
  async openCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.arProblem.set(window.isSecureContext ? 'AR.CAM.UNSUPPORTED' : 'AR.WHY.NEED_HTTPS');
      return;
    }
    this.cameraOpen.set(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      if (!this.cameraOpen()) {
        // Nguoi dung da dong truoc khi trinh duyet tra camera ve.
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      // Lop camera vua bat; doi mot nhip ve de the video co trong trang.
      if (!this.cameraVideo) {
        await new Promise((ready) => requestAnimationFrame(ready));
      }
      const video = this.cameraVideo?.nativeElement;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
    } catch (trouble) {
      this.cameraOpen.set(false);
      const denied = trouble instanceof DOMException && trouble.name === 'NotAllowedError';
      this.arProblem.set(denied ? 'AR.CAM.DENIED' : 'AR.CAM.FAILED');
    }
  }

  closeCamera(): void {
    this.stopStream();
    this.cameraOpen.set(false);
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
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
    // Van thu mo; trong trinh duyet nhung hay tren may Apple thi giu loi nhac.
    this.arProblem.set(
      IN_APP_BROWSER.test(navigator.userAgent) ? 'AR.WHY.IN_APP' : this.applePhone ? 'AR.WHY.APPLE_STILL' : '',
    );
    Promise.resolve(viewer.activateAR()).catch(() => this.arProblem.set('AR.WHY.FAILED'));
  }
}
