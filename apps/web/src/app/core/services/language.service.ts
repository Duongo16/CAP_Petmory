import { DOCUMENT, Injectable, RendererFactory2, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/** Hai ngon ngu cua giao dien. */
export type Language = 'vi' | 'en';

const STORAGE_KEY = 'pm-lang';

function isLanguage(value: string | null): value is Language {
  return value === 'vi' || value === 'en';
}

/**
 * Giu ngon ngu dang dung cua giao dien.
 *
 * Mac dinh la tieng Viet. Lua chon cua nguoi doc duoc nho trong trinh duyet;
 * kho luu tru co the bi chan trong cua so an danh nen moi lan doc ghi deu boc
 * trong try, va khi do lua chon chi giu trong lan truy cap nay.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(RendererFactory2).createRenderer(null, null);

  private readonly state = signal<Language>(this.readStored());

  readonly current = this.state.asReadonly();
  readonly next = computed<Language>(() => (this.state() === 'vi' ? 'en' : 'vi'));

  /** Goi mot lan luc khoi dong ung dung. */
  start(): void {
    this.translate.setDefaultLang('vi');
    this.apply(this.state());
  }

  toggle(): void {
    this.select(this.next());
  }

  select(language: Language): void {
    this.state.set(language);
    this.apply(language);
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Kho luu tru bi chan: lua chon chi giu trong lan truy cap nay.
    }
  }

  private apply(language: Language): void {
    void this.translate.use(language);
    this.renderer.setAttribute(this.document.documentElement, 'lang', language);
  }

  private readStored(): Language {
    try {
      const saved = this.document.defaultView?.localStorage.getItem(STORAGE_KEY) ?? null;
      return isLanguage(saved) ? saved : 'vi';
    } catch {
      return 'vi';
    }
  }
}
