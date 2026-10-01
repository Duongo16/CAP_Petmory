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
  download: 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-13v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  shield: 'M12 3l7 2.8v5.4c0 4.3-3 8-7 9.8-4-1.8-7-5.5-7-9.8V5.8L12 3Zm-2.6 8.8 2 2 4-4.2',
  gift: 'M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Zm-1-4h18v4H3V7Zm9 0v14M12 7S10.5 3 8.2 3a2.1 2.1 0 0 0 0 4H12Zm0 0s1.5-4 3.8-4a2.1 2.1 0 0 1 0 4H12Z',
  truck: 'M3 6h10v10H3V6Zm10 4h4l3 3.4V16h-7v-6ZM7 20a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 7 20Zm10 0a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z',
  tag: 'M4 4h7.2l8.3 8.3a1.6 1.6 0 0 1 0 2.3l-4.9 4.9a1.6 1.6 0 0 1-2.3 0L4 11.2V4Zm3.6 3.6h.01',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  back: 'M19 12H5m6-6-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm0 14V5m4 2h7',
  sparkle: 'm12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4V8Zm8 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  calendar: 'M4 5h16v15H4V5Zm0 5h16M9 3v4m6-4v4',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9a6 6 0 0 1 12 0m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 6',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4v-9Z',
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
