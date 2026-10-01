import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import { PetArt } from '../../shared/pet-art/pet-art';
import { PetStarter } from './pet-starter/pet-starter';

/** A card in the features grid, with its keys written out in full. */
interface Feature {
  icon: string;
  tone: 'amber' | 'accent' | 'success' | 'memorial';
  nameKey: string;
  textKey: string;
}

/** One numbered step, with its keys written out in full. */
interface Step {
  number: string;
  tone: 'accent' | 'amber' | 'success';
  nameKey: string;
  textKey: string;
}
import { DiaryScene } from '../../shared/diary-scene/diary-scene';
import { Brand } from '../../shared/brand/brand';

@Component({
  selector: 'pm-guest-home-page',
  standalone: true,
  imports: [Brand, DiaryScene, RouterLink, TranslatePipe, Icon, PetArt, PetStarter],
  templateUrl: './guest-home-page.html',
  styleUrl: './guest-home-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestHomePage {
  readonly starterOpen = signal(false);

  readonly trust = ['LANDING.TRUST_FREE', 'LANDING.TRUST_PRIVATE', 'LANDING.TRUST_CARD'];

  readonly features: Feature[] = [
    { icon: 'book', tone: 'amber', nameKey: 'LANDING.FEATURE.DIARY.NAME', textKey: 'LANDING.FEATURE.DIARY.TEXT' },
    { icon: 'sparkle', tone: 'accent', nameKey: 'LANDING.FEATURE.MEMORY.NAME', textKey: 'LANDING.FEATURE.MEMORY.TEXT' },
    { icon: 'gift', tone: 'success', nameKey: 'LANDING.FEATURE.STUDIO.NAME', textKey: 'LANDING.FEATURE.STUDIO.TEXT' },
    { icon: 'users', tone: 'memorial', nameKey: 'LANDING.FEATURE.COMMUNITY.NAME', textKey: 'LANDING.FEATURE.COMMUNITY.TEXT' },
  ];

  readonly steps: Step[] = [
    { number: '01', tone: 'accent', nameKey: 'LANDING.STEP.1.NAME', textKey: 'LANDING.STEP.1.TEXT' },
    { number: '02', tone: 'amber', nameKey: 'LANDING.STEP.2.NAME', textKey: 'LANDING.STEP.2.TEXT' },
    { number: '03', tone: 'success', nameKey: 'LANDING.STEP.3.NAME', textKey: 'LANDING.STEP.3.TEXT' },
  ];

  openOnboarding(): void {
    this.starterOpen.set(true);
  }

  closeOnboarding(): void {
    this.starterOpen.set(false);
  }
}
