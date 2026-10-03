import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  exhaustMap,
  filter,
  forkJoin,
  interval,
  of,
  switchMap,
  take,
  tap,
} from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Icon } from '../icon/icon';
import { ChatbotService } from '../../core/services/chatbot.service';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from '../../core/services/catalog.service';
import { GoodsService } from '../../core/services/goods.service';
import { ChatSession, ChatState, ChatTurn, GoodsPage, ProductType } from '../../core/models/api.model';

/** Mot san pham tro ly vua nhac toi, hien thanh the bam duoc. */
interface Card {
  code: string;
  name: string;
  image: string;
  priceFrom: string;
  link: string;
}

/** Mot bong chu tren man hinh. */
interface Bubble {
  id: number;
  side: 'USER' | 'BOT' | 'STAFF';
  content: string;
  at: string;
  path: string;
  pathKey: string;
  cards: Card[];
}

/** Tra key ban dich cho tung trang thai cua phien. */
const KEY_STATE: Record<ChatState, string> = {
  BOT: 'ASSISTANT.STATE_BOT',
  WAITING: 'ASSISTANT.STATE_WAITING',
  WITH_STAFF: 'ASSISTANT.STATE_WITH_STAFF',
  CLOSED: 'ASSISTANT.STATE_CLOSED',
};

/**
 * Nhan cua nut dan huong theo trang dich. Viet ra tung key mot; trang khong
 * co trong danh sach thi dung nhan chung.
 */
const KEY_GO: { prefix: string; key: string }[] = [
  { prefix: '/studio', key: 'ASSISTANT.GO.STUDIO' },
  { prefix: '/shop?tab=ready', key: 'ASSISTANT.GO.READY' },
  { prefix: '/shop', key: 'ASSISTANT.GO.SHOP' },
  { prefix: '/orders', key: 'ASSISTANT.GO.ORDERS' },
  { prefix: '/pets', key: 'ASSISTANT.GO.PETS' },
  { prefix: '/restore', key: 'ASSISTANT.GO.RESTORE' },
  { prefix: '/journals', key: 'ASSISTANT.GO.JOURNALS' },
];
const KEY_GO_OTHER = 'ASSISTANT.GO_TO';

/** So the san pham toi da duoi mot cau tra loi, de khung khong bi dai. */
const CARD_MAX = 3;

/** Bao lau mot lan doc lai phien khi dang cho tu van vien, tinh bang mili giay. */
const POLL_MS = 6000;

function goKeyOf(path: string): string {
  return KEY_GO.find((one) => path.startsWith(one.prefix))?.key ?? KEY_GO_OTHER;
}

/** Phan nguyen cua mot so tien, du no ve dang chuoi hay dang so thap phan. */
function wholeOf(raw: unknown): number {
  const text =
    raw && typeof raw === 'object' && '$numberDecimal' in raw
      ? String((raw as { $numberDecimal: string }).$numberDecimal)
      : String(raw ?? '0');
  return Number(text.split('.')[0]) || 0;
}

function money(value: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
}

/** Cac cau goi y cua luot tra loi gan nhat co goi y. */
function lastSuggestions(one: ChatSession): string[] {
  for (let at = one.turn.length - 1; at >= 0; at -= 1) {
    if (one.turn[at].suggestion?.length) {
      return one.turn[at].suggestion;
    }
  }
  return [];
}

/**
 * Tro ly hoi thoai.
 *
 * Mot phien duoc mo o may chu, nen cuoc tro chuyen duoc nho lai giua cac cau
 * hoi va co the chuyen sang mot tu van vien that. Mo lai trang van thay mach
 * cu, vi ma phien duoc tim lai tu may chu chu khong giu trong trinh duyet.
 */
@Component({
  selector: 'pm-chat-widget',
  standalone: true,
  imports: [FormsModule, TranslatePipe, Icon, DatePipe],
  templateUrl: './chat-widget.html',
  styleUrl: './chat-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closeOnEscape()' },
})
export class ChatWidget implements OnInit {
  private readonly service = inject(ChatbotService);
  private readonly auth = inject(AuthService);
  private readonly catalog = inject(CatalogService);
  private readonly goods = inject(GoodsService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  private readonly log = viewChild<ElementRef<HTMLElement>>('log');
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('questionBox');

  /** Cac cau hoi xep hang, de bam nhanh hai lan khong mat cau nao. */
  private readonly outbox = new Subject<string>();

  readonly pendingOpen = signal(false);
  readonly waiting = signal(false);
  readonly contentInput = signal('');
  readonly session = signal<ChatSession | null>(null);

  /**
   * Cac cau hoi goi y. Day la noi dung kho tri thuc do nhom Quan ly soan, nen
   * hien nguyen van chu khong qua tep ban dich.
   */
  readonly suggestions = signal<string[]>([]);

  /** Tro ly chi danh cho nguoi da dang nhap. */
  readonly signedIn = this.auth.isSignedIn;

  /** Ten, anh va gia cua tung ma san pham, doc mot lan de dung the. */
  private readonly shelf = signal<Record<string, Card>>({});

  /** Dang xuat thi bo phien dang mo, de nguoi dang nhap sau khong thay cuoc tro chuyen cu. */
  protected readonly forgetOnSignOut = effect(() => {
    if (!this.signedIn()) {
      untracked(() => {
        this.session.set(null);
        this.suggestions.set([]);
      });
    }
  });

  /** Cac bong chu hien tren man hinh, kem the san pham va nut dan huong. */
  readonly history = computed<Bubble[]>(() => {
    const shelf = this.shelf();
    return (this.session()?.turn ?? []).map((one: ChatTurn, at: number) => ({
      id: at,
      side: one.side,
      content: one.text,
      at: one.at,
      path: one.path,
      pathKey: goKeyOf(one.path ?? ''),
      cards: [...(one.productCode ?? []), ...(one.goodsCode ?? [])]
        .map((code) => shelf[code])
        .filter((card): card is Card => Boolean(card))
        .slice(0, CARD_MAX),
    }));
  });

  /** Khung vua mo va o nhap vua hien thi dat con tro vao o, de go duoc ngay. */
  protected readonly focusWhenOpen = effect(() => {
    const box = this.input();
    if (this.pendingOpen() && box) {
      untracked(() => box.nativeElement.focus());
    }
  });

  /** Moi khi co tin moi hoac dang cho tra loi thi cuon xuong cuoi. */
  protected readonly followLatest = effect(() => {
    this.history();
    this.waiting();
    this.pendingOpen();
    afterNextRender(() => this.scrollToEnd(), { injector: this.injector });
  });

  readonly state = computed<ChatState>(() => this.session()?.state ?? 'BOT');

  /** Key ban dich cho dong bao trang thai. */
  readonly stateKey = computed(() => KEY_STATE[this.state()]);

  /** Chi hien loi moi gap nguoi khi may dang tra loi. */
  readonly canHandover = computed(() => this.state() === 'BOT' && this.session() !== null);

  /** Phien da khep thi khong go them duoc. */
  readonly closed = computed(() => this.state() === 'CLOSED');

  /** Bat dau cuoc moi duoc khi cuoc cu da co trao doi va khong dang cho nguoi. */
  readonly canRestart = computed(() => {
    const now = this.state();
    return (now === 'BOT' || now === 'CLOSED') && (this.session()?.turn.length ?? 0) > 1;
  });

  /** Co chu de gui va khong dang cho cau tra loi truoc. */
  readonly canSend = computed(() => this.contentInput().trim().length > 0 && !this.waiting());

  /** Chua co trao doi nao ngoai loi chao: hien goi y to hon de khach bat dau. */
  readonly fresh = computed(() => (this.session()?.turn.length ?? 0) <= 1);

  ngOnInit(): void {
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
    if (open && this.signedIn()) {
      if (!this.session()) {
        this.start();
      }
      this.loadShelf();
    }
  }

  closeOnEscape(): void {
    if (this.pendingOpen()) {
      this.pendingOpen.set(false);
    }
  }

  selectSuggestion(text: string): void {
    this.outbox.next(text);
  }

  sendFromInput(): void {
    const text = this.contentInput().trim();
    if (text.length > 0 && !this.closed() && !this.waiting()) {
      this.contentInput.set('');
      this.outbox.next(text);
    }
  }

  /** Mo trang dich. Duong dan co the kem tham so, nen mo bang ca chuoi. */
  openPath(path: string): void {
    this.pendingOpen.set(false);
    void this.router.navigateByUrl(path);
  }

  /** Dua khach chua dang nhap toi trang dang nhap, roi quay lai dung trang nay. */
  goSignIn(): void {
    this.pendingOpen.set(false);
    void this.router.navigate(['/login'], { queryParams: { continue: this.router.url } });
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

  /** Bat dau mot cuoc moi. */
  startFresh(): void {
    this.session.set(null);
    this.suggestions.set([]);
    this.openNew();
  }

  /** Dang cho hoac dang duoc mot nguoi that tra loi. */
  private awaitingPerson(): boolean {
    const now = this.state();
    return now === 'WAITING' || now === 'WITH_STAFF';
  }

  /**
   * Mo phien.
   *
   * Phien cu dang mo duoc noi lai, nen mo lai trang khong lam mat mach hoi
   * thoai. Cac cau goi y lay tu cau tra loi gan nhat, hoac tu loi chao.
   */
  private start(): void {
    this.service
      .mySession()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (found) => {
          if (found) {
            this.session.set(found);
            this.suggestions.set(lastSuggestions(found));
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
        next: (made) => {
          this.session.set(made);
          this.suggestions.set(lastSuggestions(made));
        },
        error: () =>
          this.getText('COMMON.GENERIC_ERROR', (text) => this.showLocalNote(text)),
      });
  }

  /**
   * Doc ten, anh va gia cua san pham tuy bien va hang co san mot lan, de cau
   * tra loi nhac toi ma nao thi hien the cua ma do. Doc hong thi chi khong
   * co the, cuoc tro chuyen van chay.
   */
  private loadShelf(): void {
    if (Object.keys(this.shelf()).length > 0) {
      return;
    }
    forkJoin({
      kinds: this.catalog.product$.pipe(catchError(() => of<ProductType[]>([]))),
      ready: this.goods.list({ page: 1 }).pipe(catchError(() => of<GoodsPage | null>(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ kinds, ready }) => {
        const out: Record<string, Card> = {};
        for (const one of kinds) {
          const prices = one.sizes.filter((size) => size.enabled).map((size) => wholeOf(size.price));
          out[one.code] = {
            code: one.code,
            name: one.name,
            image: one.imageUrl,
            priceFrom: prices.length > 0 ? money(Math.min(...prices)) : '',
            link: `/shop?tab=custom&product=${one.code}`,
          };
        }
        for (const one of ready?.rows ?? []) {
          const prices = one.variant.filter((each) => each.enabled).map((each) => wholeOf(each.price));
          out[one.code] = {
            code: one.code,
            name: one.name,
            image: one.images[0] ?? '',
            priceFrom: prices.length > 0 ? money(Math.min(...prices)) : '',
            link: `/shop?tab=ready&goods=${one.code}`,
          };
        }
        this.shelf.set(out);
      });
  }

  /** Gui mot cau hoi va cho den khi may chu tra ve ca phien. */
  private sendOne(question: string): Observable<ChatSession> {
    const code = this.session()?.code;
    if (!code) {
      return EMPTY;
    }
    this.waiting.set(true);
    this.suggestions.set([]);
    this.showLocalTurn(question);
    return this.service.askInSession(code, question).pipe(
      tap((got) => {
        this.waiting.set(false);
        this.session.set(got);
        this.suggestions.set(lastSuggestions(got));
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
   * hong chi nghia la lan sau se doc lai.
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

  /** Cuon vung tin nhan xuong cuoi, de tin moi nhat luon nam trong tam mat. */
  private scrollToEnd(): void {
    const box = this.log()?.nativeElement;
    if (box) {
      box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    }
  }

  /** Hien cau vua go ngay lap tuc, truoc khi may chu tra loi. */
  private showLocalTurn(text: string): void {
    this.appendLocal('USER', text);
  }

  /** Hien mot loi bao cua chinh trang, khong phai cua may chu. */
  private showLocalNote(text: string): void {
    this.appendLocal('BOT', text);
  }

  private appendLocal(side: 'USER' | 'BOT', text: string): void {
    const now = this.session();
    if (!now) {
      return;
    }
    this.session.set({
      ...now,
      turn: [
        ...now.turn,
        { side, text, suggestion: [], path: '', productCode: [], goodsCode: [], at: new Date().toISOString() },
      ],
    });
  }

  /** Doc mot cau da dich duoi dang dong chay, vi tep ban dich co the chua tai xong. */
  private getText(key: string, use: (text: string) => void): void {
    this.translate
      .get(key)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((text: string) => use(text));
  }
}
