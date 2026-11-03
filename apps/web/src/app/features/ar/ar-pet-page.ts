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
import { ArService } from '../../core/services/ar.service';
import { Icon } from '../../shared/icon/icon';
import { GuestHeader } from '../../shared/guest-header/guest-header';
import { FooterLink, SiteFooter } from '../../shared/site-footer/site-footer';
import { AR_PET_MODELS, PetArModel, arModelFor } from './ar-models';
import '@google/model-viewer';

/**
 * Trang xem be qua camera.
 *
 * Mo camera sau ngay tren trang va dat be 3D chay nhay len tren, kem nut doi
 * hoat dong. Khong bam san nhu AR cua he dieu hanh, nhung chay tren moi trinh
 * duyet co camera (ke ca iPhone) va giu duoc nut. Mo tu QR cua don (/ar/o/:code)
 * thi chon san dung be cua don do.
 */
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
  private readonly ar = inject(ArService);

  @ViewChild('modelViewerRef') modelViewerRef?: ElementRef;
  @ViewChild('cameraVideo') cameraVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('cameraViewer') cameraViewer?: ElementRef;

  readonly petList = AR_PET_MODELS;
  readonly selectedPet = signal<PetArModel>(AR_PET_MODELS[0]);
  readonly currentAnimation = signal<string>(AR_PET_MODELS[0].animations[0].key);
  /** Khoa dich loi dang hien (camera, tai mo hinh, QR hong); rong la khong co loi. */
  readonly problem = signal<string>('');

  /** Mo tu QR cua mot don: ten be de len tieu de, an phan chon be khac. */
  readonly fromOrder = signal(false);
  readonly petName = signal('');

  /** Che do camera: anh camera sau lam nen, be 3D chay nhay de len, co nut doi hoat dong. */
  readonly cameraOpen = signal(false);
  private stream: MediaStream | null = null;

  readonly signedIn = inject(AuthService).isSignedIn;
  readonly guestFooterMenu: FooterLink[] = [
    { path: '/shop', key: 'NAV.SHOP' },
    { path: '/diaries', key: 'NAV.PUBLIC_DIARIES' },
    { path: '/login', key: 'AUTH.SIGN_IN' },
    { path: '/register', key: 'LANDING.START_FREE' },
  ];

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code');
    if (code) {
      this.openFromOrder(code);
    } else {
      this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const modelId = params['model'] || params['pet'];
        if (modelId) {
          this.pickById(String(modelId));
        }
      });
    }
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.key === 'Escape' && this.cameraOpen()) {
          this.closeCamera();
        }
      });
    this.destroyRef.onDestroy(() => this.stopStream());
  }

  /** Doc be cua don tu ma trong QR roi chon san be do. */
  private openFromOrder(code: string): void {
    this.fromOrder.set(true);
    this.ar
      .view(code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (view) => {
          this.petName.set(view.petName);
          this.pickById(arModelFor(view.modelCode));
        },
        error: () => {
          // Ma sai hay don da huy: van cho xem, mo lai phan chon be.
          this.fromOrder.set(false);
          this.problem.set('AR.ORDER_NOT_FOUND');
        },
      });
  }

  private pickById(id: string): void {
    const found = this.petList.find((p) => p.id.toLowerCase() === id.toLowerCase());
    if (found) {
      this.selectPet(found);
    }
  }

  onModelLoaded(): void {
    if (this.problem() === 'AR.WHY.LOAD_FAILED') {
      this.problem.set('');
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
   * Trinh duyet chi cho dung camera tren trang https.
   */
  async openCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.problem.set(window.isSecureContext ? 'AR.CAM.UNSUPPORTED' : 'AR.WHY.NEED_HTTPS');
      return;
    }
    this.problem.set('');
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
      this.problem.set(denied ? 'AR.CAM.DENIED' : 'AR.CAM.FAILED');
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
}
