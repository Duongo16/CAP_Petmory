import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Language, LanguageService } from '../../core/services/language.service';

/** Nhan viet tat va ten day du cua tung ngon ngu, viet ra tung key de tim duoc. */
const SHORT: Record<Language, string> = { vi: 'VI', en: 'EN' };
const NAME: Record<Language, string> = { vi: 'LANG.VI', en: 'LANG.EN' };

/** Nut doi ngon ngu: hien ngon ngu se chuyen sang. */
@Component({
  selector: 'pm-language-toggle',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './language-toggle.html',
  styleUrl: './language-toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageToggle {
  private readonly language = inject(LanguageService);

  readonly short = computed(() => SHORT[this.language.next()]);
  readonly nextName = computed(() => NAME[this.language.next()]);

  press(): void {
    this.language.toggle();
  }
}
