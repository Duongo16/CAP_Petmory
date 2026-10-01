import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/** A person's picture, or the first letter of their name when they have none. */
@Component({
  selector: 'pm-user-face',
  standalone: true,
  template: `
    <span class="face" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.42">
      @if (url() && !broken()) {
        <img [src]="url()" alt="" (error)="broken.set(true)" />
      } @else {
        {{ initial() }}
      }
    </span>
  `,
  styleUrl: './user-face.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFace {
  readonly name = input('');
  readonly url = input<string | null | undefined>('');
  readonly size = input(36);

  /** A link that no longer loads falls back to the letter instead of a broken image. */
  readonly broken = signal(false);

  readonly initial = computed(() => this.name().trim().charAt(0).toUpperCase() || '?');
}
