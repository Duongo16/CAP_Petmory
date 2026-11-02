import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Brand } from '../brand/brand';
import { LanguageToggle } from '../language-toggle/language-toggle';
import { ThemeToggle } from '../theme-toggle/theme-toggle';

/** The public landing header reused by pages that are available before sign-in. */
@Component({
  selector: 'pm-guest-header',
  standalone: true,
  imports: [RouterLink, TranslatePipe, Brand, LanguageToggle, ThemeToggle],
  templateUrl: './guest-header.html',
  styleUrl: './guest-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestHeader {}
