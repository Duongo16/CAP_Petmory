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
import { Icon } from '../icon/icon';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  exhaustMap,
  filter,
  interval,
  switchMap,
  take,
  tap,
} from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ChatbotService } from '../../core/services/chatbot.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatSession, ChatState, ChatTurn } from '../../core/models/api.model';

/** Mot bong chu tren man hinh. */
interface Bubble {
  id: number;
  side: 'USER' | 'BOT' | 'STAFF';
  content: string;
  path: string;
}

/**
 * Tra key ban dich cho cac cau goi y may chu tra ve.
 *
 * Khai ra tung key mot de tim duoc bang tim kiem chu. Khong bao gio ghep
 * key tu chuoi.
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

/** Tra key ban dich cho tung trang thai cua phien. */
const KEY_STATE: Record<ChatState, string> = {
  BOT: 'ASSISTANT.STATE_BOT',
  WAITING: 'ASSISTANT.STATE_WAITING',
  WITH_STAFF: 'ASSISTANT.STATE_WITH_STAFF',
  CLOSED: 'ASSISTANT.STATE_CLOSED',
};

/** Bao lau mot lan doc lai phien khi dang cho tu van vien, tinh bang mili giay. */
const POLL_MS = 6000;

/**
 * Tro ly hoi thoai.
 *
 * Mot phien duoc mo o may chu, nen cuoc tro chuyen duoc nho lai giua cac cau
 * hoi va co the chuyen sang mot tu van vien that. Nguoi da dang nhap mo lai
 * trang van thay mach cu, vi ma phien duoc tim lai tu may chu chu khong duoc
 * giu trong trinh duyet.
 */
@Component({
  selector: 'pm-chat-widget',
  standalone: true,
  imports: [FormsModule, TranslatePipe, Icon],
  templateUrl: './chat-widget.html',
  styleUrl: './chat-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWidget implements OnInit {
  private readonly service = inject(ChatbotService);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Cac cau hoi xep hang, de bam nhanh hai lan khong mat cau nao. */
  private readonly outbox = new Subject<string>();

  readonly pendingOpen = signal(false);
  readonly waiting = signal(false);
  readonly contentInput = signal('');
  readonly session = signal<ChatSession | null>(null);

  private readonly suggestion = signal<string[]>([]);

  /** Tinh san key ban dich cho tung cau goi y, de khung nhin khong goi ham. */
  readonly suggestions = computed(() =>
    this.suggestion().map((code) => ({ code, key: KEY_SUGGESTION[code] ?? KEY_SUGGESTION_OTHER })),
  );

  /** Cac bong chu hien tren man hinh. */
  readonly history = computed<Bubble[]>(() =>
    (this.session()?.turn ?? []).map((one: ChatTurn, at: number) => ({
      id: at,
      side: one.side,
      content: one.text,
      path: one.path,
    })),
  );

  readonly state = computed<ChatState>(() => this.session()?.state ?? 'BOT');

  /** Key ban dich cho dong bao trang thai. */
  readonly stateKey = computed(() => KEY_STATE[this.state()]);

  /** Chi hien nut xin gap nguoi khi may dang tra loi. */
  readonly canHandover = computed(() => this.state() === 'BOT' && this.session() !== null);

  /** Phien da khep thi khong go them duoc. */
  readonly closed = computed(() => this.state() === 'CLOSED');

  ngOnInit(): void {
    this.service
      .initialSuggestions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (got) => this.suggestion.set(got.suggestion),
        error: () => undefined,
      });

    /*
     * Cac cau hoi di lan luot chu khong song song. Bam gui hai lan that nhanh
     * thi cau thu hai cho cau thu nhat xong, nen khong cau nao bi bo qua va
     * thu tu trong phien dung nhu nguoi dung da go.
     */
    this.outbox
      .pipe(
        exhaustMap((question) => this.sendOne(question)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    /*
     * Khi phien dang cho hoac dang do tu van vien tra loi, doc lai dinh ky de
     * cau tra loi cua nguoi truc hien ra ma khach khong phai tai lai trang.
     */
    interval(POLL_MS)
      .pipe(
        filter(() => this.pendingOpen() && this.awaitingPerson()),
        switchMap(() => this.refresh()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  toggle(): void {
    const open = !this.pendingOpen();
    this.pendingOpen.set(open);
    if (open && !this.session()) {
      this.start();
    }
  }

  selectSuggestion(key: string): void {
    this.getText(key, (text) => this.outbox.next(text));
  }

  sendFromInput(): void {
    const text = this.contentInput().trim();
    if (text.length > 0 && !this.closed()) {
      this.contentInput.set('');
      this.outbox.next(text);
    }
  }

  openPath(path: string): void {
    this.pendingOpen.set(false);
    void this.router.navigate([path]);
  }

  /** Xin gap tu van vien that. */
  askForPerson(): void {
    const code = this.session()?.code;
    if (!code || this.waiting()) {
      return;
    }
    this.waiting.set(true);
    this.service
      .handover(code, this.contentInput().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (got) => {
          this.waiting.set(false);
          this.session.set(got);
          this.contentInput.set('');
        },
        error: () => this.waiting.set(false),
      });
  }

  /** Bat dau mot cuoc moi sau khi cuoc cu da khep lai. */
  startFresh(): void {
    this.session.set(null);
    this.start();
  }

  /** Dang cho hoac dang duoc mot nguoi that tra loi. */
  private awaitingPerson(): boolean {
    const now = this.state();
    return now === 'WAITING' || now === 'WITH_STAFF';
  }

  /**
   * Mo phien.
   *
   * Nguoi da dang nhap duoc noi lai phien cu dang mo, nen mo lai trang khong
   * lam mat mach hoi thoai. Khach chua dang nhap luon bat dau mot cuoc moi.
   */
  private start(): void {
    if (!this.auth.isSignedIn()) {
      this.openNew();
      return;
    }
    this.service
      .mySession()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (found) => {
          if (found) {
            this.session.set(found);
          } else {
            this.openNew();
          }
        },
        error: () => this.openNew(),
      });
  }

  private openNew(): void {
    this.service
      .openSession()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (made) => this.session.set(made),
        error: () =>
          this.getText('COMMON.GENERIC_ERROR', (text) => this.showLocalNote(text)),
      });
  }

  /** Gui mot cau hoi va cho den khi may chu tra ve ca phien. */
  private sendOne(question: string): Observable<ChatSession> {
    const code = this.session()?.code;
    if (!code) {
      return EMPTY;
    }
    this.waiting.set(true);
    this.showLocalTurn(question);
    return this.service.askInSession(code, question).pipe(
      tap((got) => {
        this.waiting.set(false);
        this.session.set(got);
        const last = got.turn[got.turn.length - 1];
        if (last?.suggestion?.length) {
          this.suggestion.set(last.suggestion);
        }
      }),
      catchError(() => {
        this.waiting.set(false);
        this.getText('COMMON.GENERIC_ERROR', (text) => this.showLocalNote(text));
        return EMPTY;
      }),
    );
  }

  /**
   * Doc lai phien tu may chu.
   *
   * Loi o day khong bao ra man hinh: doc lai la viec chay ngam, va mot lan
   * hong chi nghia la lan sau se doc lai. Bao loi moi sau giay se lam nguoi
   * dung hoang mang ma khong giup duoc gi.
   */
  private refresh(): Observable<ChatSession> {
    const code = this.session()?.code;
    if (!code) {
      return EMPTY;
    }
    return this.service.readSession(code).pipe(
      tap((got) => this.session.set(got)),
      catchError(() => EMPTY),
    );
  }

  /** Hien cau vua go ngay lap tuc, truoc khi may chu tra loi. */
  private showLocalTurn(text: string): void {
    const now = this.session();
    if (!now) {
      return;
    }
    this.session.set({
      ...now,
      turn: [
        ...now.turn,
        {
          side: 'USER',
          text,
          suggestion: [],
          path: '',
          productCode: [],
          goodsCode: [],
          at: new Date().toISOString(),
        },
      ],
    });
  }

  /** Hien mot loi bao cua chinh trang, khong phai cua may chu. */
  private showLocalNote(text: string): void {
    const now = this.session();
    if (!now) {
      return;
    }
    this.session.set({
      ...now,
      turn: [
        ...now.turn,
        {
          side: 'BOT',
          text,
          suggestion: [],
          path: '',
          productCode: [],
          goodsCode: [],
          at: new Date().toISOString(),
        },
      ],
    });
  }

  /**
   * Doc mot cau da dich duoi dang dong chay chu khong doc thang.
   *
   * Tep ban dich duoc tai qua mang nen co the chua san sang ngay luc goi.
   */
  private getText(key: string, use: (text: string) => void): void {
    this.translate
      .get(key)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((text: string) => use(text));
  }
}
