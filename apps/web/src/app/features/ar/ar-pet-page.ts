import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Icon } from '../../shared/icon/icon';
import '@google/model-viewer';

export interface PetArModel {
  id: string;
  name: string;
  kind: string;
  emoji: string;
  badge: string;
  file: string;
  defaultScale: string;
  animations: {
    key: string;
    label: string;
    icon: string;
  }[];
}

export const AR_PET_MODELS: PetArModel[] = [
  {
    id: 'shiba',
    name: 'Chó Shiba Inu',
    kind: 'DOG',
    emoji: '🐕',
    badge: 'Chạy nhanh (Gallop)',
    file: '/models/q-ShibaInu.glb',
    defaultScale: '1 1 1',
    animations: [
      { key: 'AnimalArmature|Gallop', label: 'Chạy nước đại', icon: '⚡' },
      { key: 'AnimalArmature|Walk', label: 'Đi dạo', icon: '🐾' },
      { key: 'AnimalArmature|Idle', label: 'Đứng yên', icon: '💤' },
      { key: 'AnimalArmature|Jump_ToIdle', label: 'Nhảy bật', icon: '🦘' },
      { key: 'AnimalArmature|Eating', label: 'Ăn ngon', icon: '🍖' },
    ],
  },
  {
    id: 'husky',
    name: 'Chó Husky',
    kind: 'DOG',
    emoji: '🐺',
    badge: 'Chạy nhanh (Gallop)',
    file: '/models/q-Husky.glb',
    defaultScale: '1 1 1',
    animations: [
      { key: 'AnimalArmature|Gallop', label: 'Chạy nước đại', icon: '⚡' },
      { key: 'AnimalArmature|Walk', label: 'Đi dạo', icon: '🐾' },
      { key: 'AnimalArmature|Idle', label: 'Đứng yên', icon: '💤' },
      { key: 'AnimalArmature|Jump_ToIdle', label: 'Nhảy bật', icon: '🦘' },
      { key: 'AnimalArmature|Eating', label: 'Ăn ngon', icon: '🍖' },
    ],
  },
  {
    id: 'fox',
    name: 'Cáo nhỏ',
    kind: 'OTHER',
    emoji: '🦊',
    badge: 'Chạy nhanh (Gallop)',
    file: '/models/q-Fox.glb',
    defaultScale: '1 1 1',
    animations: [
      { key: 'AnimalArmature|Gallop', label: 'Chạy nước đại', icon: '⚡' },
      { key: 'AnimalArmature|Walk', label: 'Đi dạo', icon: '🐾' },
      { key: 'AnimalArmature|Idle', label: 'Đứng yên', icon: '💤' },
      { key: 'AnimalArmature|Jump_ToIdle', label: 'Nhảy bật', icon: '🦘' },
    ],
  },
  {
    id: 'bunny',
    name: 'Thỏ con',
    kind: 'OTHER',
    emoji: '🐰',
    badge: 'Chạy / Nhảy',
    file: '/models/animal-bunny.glb',
    defaultScale: '1 1 1',
    animations: [
      { key: 'run', label: 'Chạy', icon: '⚡' },
      { key: 'walk', label: 'Đi dạo', icon: '🐾' },
      { key: 'dance', label: 'Nhảy múa', icon: '🎵' },
      { key: 'idle', label: 'Đứng yên', icon: '💤' },
      { key: 'eat', label: 'Gặm cỏ', icon: '🥕' },
    ],
  },
  {
    id: 'panda',
    name: 'Gấu trúc',
    kind: 'OTHER',
    emoji: '🐼',
    badge: 'Chạy / Nhảy',
    file: '/models/animal-panda.glb',
    defaultScale: '1 1 1',
    animations: [
      { key: 'run', label: 'Chạy', icon: '⚡' },
      { key: 'walk', label: 'Đi dạo', icon: '🐾' },
      { key: 'dance', label: 'Nhảy múa', icon: '🎵' },
      { key: 'idle', label: 'Đứng yên', icon: '💤' },
      { key: 'eat', label: 'Ăn trúc', icon: '🎋' },
    ],
  },
];

@Component({
  selector: 'pm-ar-pet-page',
  standalone: true,
  imports: [CommonModule, RouterModule, Icon],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './ar-pet-page.html',
  styleUrls: ['./ar-pet-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArPetPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild('modelViewerRef') modelViewerRef?: ElementRef;

  readonly petList = AR_PET_MODELS;
  readonly selectedPet = signal<PetArModel>(AR_PET_MODELS[0]);
  readonly currentAnimation = signal<string>(AR_PET_MODELS[0].animations[0].key);
  readonly currentScale = signal<string>('1 1 1');
  readonly isArSupported = signal<boolean>(true);
  readonly arStatusMessage = signal<string>('');

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
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
  }

  selectPet(pet: PetArModel): void {
    this.selectedPet.set(pet);
    // Tự động chọn animation đầu tiên (chạy nước đại / run)
    if (pet.animations.length > 0) {
      this.currentAnimation.set(pet.animations[0].key);
    }
  }

  selectAnimation(animKey: string): void {
    this.currentAnimation.set(animKey);
    const viewer = this.modelViewerRef?.nativeElement;
    if (viewer) {
      viewer.animationName = animKey;
      viewer.play();
    }
  }

  setScale(scaleMultiplier: number): void {
    const s = `${scaleMultiplier} ${scaleMultiplier} ${scaleMultiplier}`;
    this.currentScale.set(s);
    const viewer = this.modelViewerRef?.nativeElement;
    if (viewer) {
      viewer.scale = s;
    }
  }

  launchAr(): void {
    const viewer = this.modelViewerRef?.nativeElement;
    if (viewer && typeof viewer.activateAR === 'function') {
      viewer.activateAR();
    } else {
      this.arStatusMessage.set('Đang kích hoạt chế độ AR...');
    }
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/']);
    }
  }
}
