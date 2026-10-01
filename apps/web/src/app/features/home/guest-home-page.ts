import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import { PetArt } from '../../shared/pet-art/pet-art';

type OnboardingStep = 1 | 2 | null;

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

@Component({
  selector: 'pm-guest-home-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe, Icon, PetArt],
  templateUrl: './guest-home-page.html',
  styleUrl: './guest-home-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestHomePage {
  readonly onboardingStep = signal<OnboardingStep>(null);

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

  readonly perks = ['LANDING.MODAL.PERK_1', 'LANDING.MODAL.PERK_2', 'LANDING.MODAL.PERK_3', 'LANDING.MODAL.PERK_4'];

  openOnboarding(): void {
    this.onboardingStep.set(1);
  }

  nextOnboardingStep(): void {
    this.onboardingStep.set(2);
  }

  closeOnboarding(): void {
    this.onboardingStep.set(null);
  }
}
