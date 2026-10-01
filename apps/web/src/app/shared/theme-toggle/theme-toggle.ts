import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ThemeChoice, ThemeService } from '../../core/services/theme.service';
import { Icon } from '../icon/icon';

/** The icon shown for each setting. Written out so no key is built at runtime. */
const GLYPH: Record<ThemeChoice, string> = {
  LIGHT: 'sun',
  DARK: 'moon',
};

/** The label for each setting. Written out so every key stays searchable. */
const LABEL: Record<ThemeChoice, string> = {
  LIGHT: 'THEME.LIGHT',
  DARK: 'THEME.DARK',
};

@Component({
  selector: 'pm-theme-toggle',
  standalone: true,
  imports: [TranslatePipe, Icon],
  templateUrl: './theme-toggle.html',
  styleUrl: './theme-toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggle {
  private readonly theme = inject(ThemeService);

  readonly glyph = computed(() => GLYPH[this.theme.choice()]);
  readonly label = computed(() => LABEL[this.theme.choice()]);
  readonly nextLabel = computed(() => LABEL[this.theme.next()]);

  press(): void {
    this.theme.cycle();
  }
}
