import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
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
import { PetHero } from './pet-hero/pet-hero';
import { Brand } from '../../shared/brand/brand';

import { LanguageToggle } from '../../shared/language-toggle/language-toggle';
import { ThemeToggle } from '../../shared/theme-toggle/theme-toggle';

@Component({
  selector: 'pm-guest-home-page',
  standalone: true,
  imports: [Brand, PetHero, RouterLink, TranslatePipe, Icon, PetStarter, LanguageToggle, ThemeToggle],
  templateUrl: './guest-home-page.html',
  styleUrl: './guest-home-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestHomePage {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly starterOpen = signal(false);
  readonly authPromptOpen = signal(false);

  constructor() {
    // Anh nen nam duoi thanh dinh: do chieu cao that cua thanh (dien thoai co hai hang)
    // de anh vua khit man hinh va chu khong bi thanh dinh che.
    afterNextRender(() => {
      const bar = this.host.nativeElement.querySelector<HTMLElement>('.lp-bar');
      if (!bar) {
        return;
      }
      const sync = () =>
        this.host.nativeElement.style.setProperty('--lp-bar-h', `${Math.round(bar.getBoundingClientRect().height)}px`);
      sync();
      const watch = new ResizeObserver(sync);
      watch.observe(bar);
      this.destroyRef.onDestroy(() => watch.disconnect());
    });
  }

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

  /** Nut "Kham pha" tren anh nen: cuon toi lop noi dung, chua cho thanh dinh dang dinh. */
  scrollToStart(event: Event): void {
    event.preventDefault();
    const front = document.getElementById('start');
    if (!front) {
      return;
    }
    const bar = document.querySelector('.lp-bar')?.getBoundingClientRect().height ?? 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: front.getBoundingClientRect().top + window.scrollY - bar, behavior: reduce ? 'auto' : 'smooth' });
  }

  openOnboarding(): void {
    this.starterOpen.set(true);
  }

  closeOnboarding(): void {
    this.starterOpen.set(false);
  }

  openAuthPrompt(): void { this.authPromptOpen.set(true); }
  closeAuthPrompt(): void { this.authPromptOpen.set(false); }
}
