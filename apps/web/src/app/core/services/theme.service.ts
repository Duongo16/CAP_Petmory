import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { RendererFactory2 } from '@angular/core';

/** The two settings the reader can pick between. */
export type ThemeChoice = 'LIGHT' | 'DARK';

const STORAGE_KEY = 'pm-theme';
const ATTRIBUTE = 'data-theme';

function isChoice(value: string | null): value is ThemeChoice {
  return value === 'LIGHT' || value === 'DARK';
}

/**
 * Holds whether the interface is light or dark.
 *
 * On a first visit the setting of the operating system decides, after which the
 * reader is in charge and the pick is kept in browser storage. Storage can throw
 * in a private window, so every access is guarded.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(RendererFactory2).createRenderer(null, null);

  private readonly state = signal<ThemeChoice>(this.readStored());

  /** Which setting is active right now. */
  readonly choice = this.state.asReadonly();

  /** The setting a press would move to, used for the button label. */
  readonly next = computed<ThemeChoice>(() => (this.state() === 'DARK' ? 'LIGHT' : 'DARK'));

  constructor() {
    this.apply(this.state());
  }

  /** Swaps between the two settings. */
  cycle(): void {
    this.select(this.next());
  }

  select(choice: ThemeChoice): void {
    this.state.set(choice);
    this.apply(choice);
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Storage can be blocked. The setting then lasts only for this visit.
    }
  }

  private apply(choice: ThemeChoice): void {
    this.renderer.setAttribute(
      this.document.documentElement,
      ATTRIBUTE,
      choice === 'DARK' ? 'dark' : 'light',
    );
  }

  private readStored(): ThemeChoice {
    try {
      const view = this.document.defaultView;
      const saved = view?.localStorage.getItem(STORAGE_KEY) ?? null;
      if (isChoice(saved)) {
        return saved;
      }
      return view?.matchMedia('(prefers-color-scheme: dark)').matches ? 'DARK' : 'LIGHT';
    } catch {
      return 'LIGHT';
    }
  }
}
