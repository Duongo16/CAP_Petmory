import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ChatbotService } from '../../core/services/chatbot.service';

interface ChatMessage {
  id: number;
  fromCustomer: boolean;
  content: string;
  path: string | null;
}

/**
 * Translation key lookup for the suggestions the server returns. Declared explicitly
 * so every key is greppable; keys are never built by string concatenation.
 */
const KEY_SUGGESTION: Record<string, string> = {
  PRICE: 'ASSISTANT.SUGGESTION.PRICE',
  LEAD_TIME: 'ASSISTANT.SUGGESTION.LEAD_TIME',
  SIZES: 'ASSISTANT.SUGGESTION.SIZES',
  MATERIAL: 'ASSISTANT.SUGGESTION.MATERIAL',
  PROCESS: 'ASSISTANT.SUGGESTION.PROCESS',
  PHOTO: 'ASSISTANT.SUGGESTION.PHOTO',
  PAYMENT: 'ASSISTANT.SUGGESTION.PAYMENT',
};

const KEY_SUGGESTION_OTHER = 'ASSISTANT.SUGGESTION.OTHER';

@Component({
  selector: 'pm-chat-widget',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './chat-widget.html',
  styleUrl: './chat-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWidget implements OnInit {
  private readonly service = inject(ChatbotService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private idCounter = 0;

  readonly pendingOpen = signal(false);
  readonly waiting = signal(false);
  readonly contentInput = signal('');
  readonly history = signal<ChatMessage[]>([]);

  private readonly suggestion = signal<string[]>([]);

  /** Precomputes each suggestion's translation key so the view calls no functions. */
  readonly suggestions = computed(() =>
    this.suggestion().map((code) => ({ code, key: KEY_SUGGESTION[code] ?? KEY_SUGGESTION_OTHER })),
  );

  ngOnInit(): void {
    this.service
      .initialSuggestions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (kq) => this.suggestion.set(kq.suggestion),
        error: () => undefined,
      });
  }

  toggle(): void {
    const open = !this.pendingOpen();
    this.pendingOpen.set(open);
    if (open && this.history().length === 0) {
      this.getText('ASSISTANT.GREETING', (text) => this.addAssistantMessage(text, null));
    }
  }

  selectSuggestion(key: string): void {
    this.getText(key, (text) => this.send(text));
  }

  sendFromInput(): void {
    const text = this.contentInput().trim();
    if (text.length > 0) {
      this.send(text);
    }
  }

  openPath(path: string): void {
    this.pendingOpen.set(false);
    void this.router.navigate([path]);
  }

  private send(question: string): void {
    if (this.waiting()) {
      return;
    }
    this.contentInput.set('');
    this.waiting.set(true);
    this.add(question, true, null);

    this.service
      .ask(question)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tl) => {
          this.waiting.set(false);
          this.addAssistantMessage(tl.content, tl.path);
          this.suggestion.set(tl.suggestion);
        },
        error: () => {
          this.waiting.set(false);
          this.getText('COMMON.GENERIC_ERROR', (text) => this.addAssistantMessage(text, null));
        },
      });
  }

  /**
   * Reads a translated string as a stream rather than synchronously, because the
   * translation file is fetched over the network and may not be ready yet.
   */
  private getText(key: string, handleHandle: (text: string) => void): void {
    this.translate
      .get(key)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((text: string) => handleHandle(text));
  }

  private addAssistantMessage(content: string, path: string | null): void {
    this.add(content, false, path);
  }

  private add(content: string, fromCustomer: boolean, path: string | null): void {
    this.idCounter += 1;
    const next: ChatMessage = { id: this.idCounter, fromCustomer, content, path };
    this.history.update((ds) => [...ds, next]);
  }
}
