import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * The line icons used across the interface, drawn inline.
 *
 * Emoji were tried first but several of them fall back to an empty box on
 * Windows, so the shapes are drawn here instead. Each entry is the path data
 * of a 24 by 24 icon.
 */
const PATHS: Record<string, string> = {
  cart: 'M6 6h15l-1.5 9h-12L6 6Zm0 0L5.2 3H3m4.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5.5 12.5L21 21',
  heart: 'M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.8a4.1 4.1 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20Z',
  comment: 'M20 12a7.5 7.5 0 0 1-10.9 6.7L4 20l1.3-4.1A7.5 7.5 0 1 1 20 12Z',
  bookmark: 'M7 4h10a1 1 0 0 1 1 1v15l-6-3.6L6 20V5a1 1 0 0 1 1-1Z',
  trash: 'M4 7h16M10 7V5h4v2m-7 0 .8 13h8.4L17 7',
  image: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm2 11 4.2-4.8 3 3.2 2.6-2.4L20 16M9.5 9.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  candle: 'M12 3s2 2 2 3.4A2 2 0 0 1 10 6.4C10 5 12 3 12 3Zm-3 7h6v10H9V10Z',
  bulb: 'M9.5 18h5m-4.5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.1 1 1.6h5c.1-.5.4-1.1 1-1.6A6 6 0 0 0 12 3Z',
  star: 'm12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8L12 4Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8a8 8 0 0 1 16 0',
  paw: 'M7.5 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm9 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 17.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm14 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 21c-2.5 0-4-1.5-4-3.2 0-1.8 1.8-3.3 4-3.3s4 1.5 4 3.3C16 19.5 14.5 21 12 21Z',
  chevron: 'm9 6 6 6-6 6',
  check: 'm5 13 4 4 10-10',
  close: 'M6 6l12 12M18 6 6 18',
};

@Component({
  selector: 'pm-icon',
  standalone: true,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.aria-hidden]="true"
      focusable="false"
    >
      <path [attr.d]="path()" [attr.fill]="filled() ? 'currentColor' : 'none'" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(20);
  /** Solid rather than outline, used for a heart that has been pressed. */
  readonly filled = input(false);

  readonly path = computed(() => PATHS[this.name()] ?? '');
}
