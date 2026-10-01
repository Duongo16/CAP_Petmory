import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, Observable, Subject, catchError, concatMap, filter, interval, switchMap, tap } from 'rxjs';
import { ChatbotService } from '../../core/services/chatbot.service';
import { ChatSession, ChatState, ChatTurn } from '../../core/models/api.model';

/** Tra key ban dich cho tung trang thai cua phien. */
const KEY_STATE: Record<ChatState, string> = {
  BOT: 'ASSISTANT.STATE_BOT',
  WAITING: 'ADMIN.CHAT.STATE_WAITING',
  WITH_STAFF: 'ADMIN.CHAT.STATE_WITH_STAFF',
  CLOSED: 'ADMIN.CHAT.STATE_CLOSED',
};

/** Tra key ban dich cho ben da noi mot luot. */
const KEY_SIDE: Record<string, string> = {
  USER: 'ADMIN.CHAT.SIDE_USER',
  BOT: 'ADMIN.CHAT.SIDE_BOT',
  STAFF: 'ADMIN.CHAT.SIDE_STAFF',
};

/** Bao lau mot lan doc lai hang cho, tinh bang mili giay. */
const POLL_MS = 8000;

/** Mot dong trong hang cho, da chuan bi de ve. */
interface QueueRow {
  code: string;
  who: string;
  state: ChatState;
  stateKey: string;
  lastAt: string;
  note: string;
  lastText: string;
}

/**
 * Trang truc hoi thoai cua nhom Cham soc khach hang, theo Phu luc 01 muc 18.
 *
 * Hang cho xep theo nguoi doi lau nhat len truoc. Mot phien phai duoc nhan
 * truoc khi tra loi duoc, nen hai nhan vien khong cung tra loi mot khach va
 * khach khong nhan hai cau tra loi nguoc nhau.
 */
@Component({
  selector: 'pm-admin-chats-page',
  standalone: true,
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './admin-chats-page.html',
  styleUrls: ['./admin-shared.scss', './admin-chats-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminChatsPage implements OnInit {
  private readonly service = inject(ChatbotService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Cac thao tac ghi, di lan luot chu khong song song.
   *
   * Nhan phien, tra loi va khep phien deu doi trang thai, nen chung phai den
   * may chu dung thu tu nguoi truc da bam.
   */
  private readonly acted = new Subject<Observable<ChatSession>>();

  readonly queue = signal<ChatSession[]>([]);
  readonly open = signal<ChatSession | null>(null);
  readonly working = signal(false);
  readonly problem = signal('');
  readonly typed = signal('');

  readonly rows = computed<QueueRow[]>(() =>
    this.queue().map((one) => ({
      code: one.code,
      who: nameOf(one),
      state: one.state,
      stateKey: KEY_STATE[one.state],
      lastAt: one.lastAt,
      note: one.handoverNote,
      lastText: one.turn[one.turn.length - 1]?.text ?? '',
    })),
  );

  readonly turns = computed<(ChatTurn & { id: number; sideKey: string })[]>(() =>
    (this.open()?.turn ?? []).map((one, at) => ({
      ...one,
      id: at,
      sideKey: KEY_SIDE[one.side] ?? KEY_SIDE['BOT'],
    })),
  );

  readonly openWho = computed(() => {
    const one = this.open();
    return one ? nameOf(one) : '';
  });

  readonly openStateKey = computed(() => {
    const one = this.open();
    return one ? KEY_STATE[one.state] : '';
  });

  /** Chua nhan thi chua tra loi duoc, dung nhu may chu bat buoc. */
  readonly canTake = computed(() => this.open()?.state === 'WAITING');
  readonly canReply = computed(() => this.open()?.state === 'WITH_STAFF');
  readonly canClose = computed(() => {
    const now = this.open()?.state;
    return now === 'WAITING' || now === 'WITH_STAFF';
  });

  ngOnInit(): void {
    this.reload();

    this.acted
      .pipe(
        concatMap((work) => work),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (got) => {
          this.working.set(false);
          this.open.set(got);
          this.reload();
        },
        error: () => {
          this.working.set(false);
          this.problem.set('ADMIN.CHAT.ERROR_ACT');
        },
      });

    /*
     * Doc lai hang cho dinh ky, va doc lai ca phien dang mo, de cau khach vua
     * go hien ra ma nguoi truc khong phai tai lai trang.
     */
    interval(POLL_MS)
      .pipe(
        filter(() => !this.working()),
        switchMap(() => this.refresh()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  choose(code: string): void {
    this.problem.set('');
    this.service
      .staffRead(code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (got) => this.open.set(got),
        error: () => this.problem.set('ADMIN.CHAT.ERROR_READ'),
      });
  }

  take(): void {
    const code = this.open()?.code;
    if (!code || this.working()) {
      return;
    }
    this.begin();
    this.acted.next(this.service.takeChat(code));
  }

  send(): void {
    const code = this.open()?.code;
    const text = this.typed().trim();
    if (!code || text === '' || this.working()) {
      return;
    }
    this.begin();
    this.typed.set('');
    this.acted.next(this.service.staffReply(code, text));
  }

  close(): void {
    const code = this.open()?.code;
    if (!code || this.working()) {
      return;
    }
    this.begin();
    this.acted.next(this.service.closeChat(code));
  }

  private begin(): void {
    this.problem.set('');
    this.working.set(true);
  }

  private reload(): void {
    this.service
      .waitingChats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => this.queue.set(rows),
        error: () => this.problem.set('ADMIN.CHAT.ERROR_QUEUE'),
      });
  }

  /**
   * Doc lai hang cho va phien dang mo.
   *
   * Loi o day khong bao ra man hinh: doc lai la viec chay ngam, va mot lan
   * hong chi nghia la lan sau se doc lai.
   */
  private refresh(): Observable<ChatSession[]> {
    const code = this.open()?.code;
    if (code) {
      this.service
        .staffRead(code)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (got) => this.open.set(got), error: () => undefined });
    }
    return this.service.waitingChats().pipe(
      tap((rows) => this.queue.set(rows)),
      catchError(() => EMPTY),
    );
  }
}

/** Ten nguoi hoi, hoac chu khach van dang xem khi ho chua dang nhap. */
function nameOf(one: ChatSession): string {
  const owner = one.owner;
  if (owner && typeof owner === 'object') {
    return owner.fullName || owner.email;
  }
  return '';
}
