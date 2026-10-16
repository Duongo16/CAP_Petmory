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

/** Mot tam anh tranh len trong thu muc anh trang gioi thieu, kem kich thuoc that de khong nhay bo cuc. */
interface FeltPhoto {
  file: string;
  width: number;
  height: number;
}

/** Khung treo tren buc tuong o man dau; slot quyet dinh vi tri va nhip dung dua. */
interface CoverFrame extends FeltPhoto {
  slot: 'a' | 'b' | 'c';
}

/** Mot khung tren buc tuong ky niem: goc treo lech, so cot chiem, nhan kieu khung. */
interface WallFrame extends FeltPhoto {
  tilt: number;
  span: number;
  styleKey: string;
  altKey: string;
}

/** Mot buoc trong quy trinh lam tranh len, co thu tu that nen danh so. */
interface ProcessStep extends FeltPhoto {
  number: string;
  nameKey: string;
  textKey: string;
  altKey: string;
}

/** Mot dang khung de khach chon. */
interface FrameStyle extends FeltPhoto {
  nameKey: string;
  textKey: string;
  altKey: string;
}

import { BounceText } from './landing-fx/bounce-text';
import { RevealDirective } from './landing-fx/reveal.directive';
import { TiltDirective } from './landing-fx/tilt.directive';
import { Brand } from '../../shared/brand/brand';

import { LanguageToggle } from '../../shared/language-toggle/language-toggle';
import { ThemeToggle } from '../../shared/theme-toggle/theme-toggle';

@Component({
  selector: 'pm-guest-home-page',
  standalone: true,
  imports: [Brand, BounceText, RevealDirective, TiltDirective, RouterLink, TranslatePipe, Icon, PetStarter, LanguageToggle, ThemeToggle],
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

  readonly features: Feature[] = [
    { icon: 'book', tone: 'amber', nameKey: 'LANDING.FEATURE.DIARY.NAME', textKey: 'LANDING.FEATURE.DIARY.TEXT' },
    { icon: 'sparkle', tone: 'accent', nameKey: 'LANDING.FEATURE.MEMORY.NAME', textKey: 'LANDING.FEATURE.MEMORY.TEXT' },
    { icon: 'gift', tone: 'success', nameKey: 'LANDING.FEATURE.STUDIO.NAME', textKey: 'LANDING.FEATURE.STUDIO.TEXT' },
    { icon: 'users', tone: 'memorial', nameKey: 'LANDING.FEATURE.COMMUNITY.NAME', textKey: 'LANDING.FEATURE.COMMUNITY.TEXT' },
  ];

  readonly coverFrames: CoverFrame[] = [
    { slot: 'a', file: 'chihuahua-oval', width: 675, height: 900 },
    { slot: 'b', file: 'shepherd-frame', width: 600, height: 900 },
    { slot: 'c', file: 'ginger-frame', width: 389, height: 589 },
  ];

  readonly marquee = [
    'LANDING.FELT.MARQUEE.1',
    'LANDING.FELT.MARQUEE.2',
    'LANDING.FELT.MARQUEE.3',
    'LANDING.FELT.MARQUEE.4',
    'LANDING.FELT.MARQUEE.5',
  ];

  readonly wallFrames: WallFrame[] = [
    { file: 'bulldog-oval', width: 600, height: 900, tilt: -3, span: 2, styleKey: 'LANDING.FELT.STYLE.OVAL', altKey: 'LANDING.FELT.ALT.BULLDOG' },
    { file: 'scottish-frame', width: 341, height: 480, tilt: 2, span: 1, styleKey: 'LANDING.FELT.STYLE.WOOD', altKey: 'LANDING.FELT.ALT.SCOTTISH' },
    { file: 'calico-frame', width: 342, height: 479, tilt: -2, span: 1, styleKey: 'LANDING.FELT.STYLE.BLACK', altKey: 'LANDING.FELT.ALT.CALICO' },
    { file: 'collie-panel', width: 736, height: 789, tilt: 3, span: 2, styleKey: 'LANDING.FELT.STYLE.PANEL', altKey: 'LANDING.FELT.ALT.COLLIE' },
    { file: 'chihuahua-oval', width: 675, height: 900, tilt: -2, span: 1, styleKey: 'LANDING.FELT.STYLE.OVAL', altKey: 'LANDING.FELT.ALT.CHIHUAHUA' },
    { file: 'ginger-frame', width: 389, height: 589, tilt: 2, span: 1, styleKey: 'LANDING.FELT.STYLE.WOOD', altKey: 'LANDING.FELT.ALT.GINGER' },
  ];

  readonly processSteps: ProcessStep[] = [
    { number: '1', file: 'doodle-hoop', width: 600, height: 900, nameKey: 'LANDING.FELT.STEP.1.NAME', textKey: 'LANDING.FELT.STEP.1.TEXT', altKey: 'LANDING.FELT.ALT.DOODLE' },
    { number: '2', file: 'hoop-set', width: 675, height: 900, nameKey: 'LANDING.FELT.STEP.2.NAME', textKey: 'LANDING.FELT.STEP.2.TEXT', altKey: 'LANDING.FELT.ALT.HOOPS' },
    { number: '3', file: 'needle-work', width: 676, height: 900, nameKey: 'LANDING.FELT.STEP.3.NAME', textKey: 'LANDING.FELT.STEP.3.TEXT', altKey: 'LANDING.FELT.ALT.NEEDLE' },
    { number: '4', file: 'scottish-stand', width: 342, height: 479, nameKey: 'LANDING.FELT.STEP.4.NAME', textKey: 'LANDING.FELT.STEP.4.TEXT', altKey: 'LANDING.FELT.ALT.STAND' },
  ];

  readonly frameStyles: FrameStyle[] = [
    { file: 'shepherd-frame', width: 600, height: 900, nameKey: 'LANDING.FELT.STYLE.WOOD', textKey: 'LANDING.FELT.STYLE_TEXT.WOOD', altKey: 'LANDING.FELT.ALT.SHEPHERD' },
    { file: 'bulldog-oval', width: 600, height: 900, nameKey: 'LANDING.FELT.STYLE.OVAL', textKey: 'LANDING.FELT.STYLE_TEXT.OVAL', altKey: 'LANDING.FELT.ALT.BULLDOG' },
    { file: 'hoop-set', width: 675, height: 900, nameKey: 'LANDING.FELT.STYLE.HOOPS', textKey: 'LANDING.FELT.STYLE_TEXT.HOOPS', altKey: 'LANDING.FELT.ALT.HOOPS' },
    { file: 'calico-frame', width: 342, height: 479, nameKey: 'LANDING.FELT.STYLE.BLACK', textKey: 'LANDING.FELT.STYLE_TEXT.BLACK', altKey: 'LANDING.FELT.ALT.CALICO' },
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
