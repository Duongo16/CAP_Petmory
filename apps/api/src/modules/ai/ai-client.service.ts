import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AiMode } from './schemas/ai-usage.schema';

/** Mot buc anh gui kem cau hoi. */
export interface AiPicture {
  /** Noi dung anh da ma hoa sang chuoi chu cai. */
  data: string;
  /** Loai tep, vi du image/png hoac image/jpeg. */
  kind: string;
}

/** Mot lan hoi mo hinh ngon ngu. */
export interface AiAsk {
  /** Loi dan dat, mo ta vai tro va gioi han cua cau tra loi. */
  system: string;
  /** Cau hoi that. */
  prompt: string;
  picture?: AiPicture[];
  /** Do dai toi da cua cau tra loi. */
  maxWords?: number;
}

/** Ket qua mot lan hoi. */
export interface AiAnswer {
  /** Loi mo hinh tra ve. Rong khi khong goi duoc dich vu that. */
  text: string;
  /**
   * LIVE nghia la loi nay do dich vu that tra ve. SAMPLE nghia la khong goi
   * duoc, ben goi phai tu dung bo tra loi mau cua rieng minh.
   */
  mode: AiMode;
  /** Vi sao khong goi duoc. Rong khi moi thu on. */
  problem: string;
}

/** Bao nhieu lan hong lien tiep thi ngung goi mot luc. */
const BREAK_AFTER = 3;

/** Ngung goi bao lau sau khi cau dao mo, tinh bang mili giay. */
const BREAK_MS = 60_000;

/** So lan thu lai trong mot lan goi. Chi thu lai voi loi tam thoi. */
const RETRY = 1;

/** Ly do ghi vao so khi chua co khoa dich vu. */
const NO_KEY = 'Chua cau hinh khoa dich vu';

/** Ly do ghi vao so khi cau dao dang mo. */
const BREAK_OPEN = 'Cau dao dang mo sau nhieu lan goi hong';

/**
 * Cho duy nhat trong he thong goi ra dich vu mo hinh ngon ngu.
 *
 * Moi chuc nang dung tri tue nhan tao deu di qua day, nen thoi gian cho, so
 * lan thu lai va cau dao chi phai dat mot cho. Khoa dich vu doc tu bien moi
 * truong va khong bao gio duoc ghi ra nhat ky hay tra ve cho nguoi dung.
 *
 * Khong lan goi nao o day nem loi ra ngoai. Khi dich vu that khong dung duoc,
 * ket qua tra ve mang dau SAMPLE kem ly do, va ben goi tu quyet dinh dung loi
 * mau nao. Nho vay mot su co ben ngoai khong lam hong chuc nang chinh.
 */
@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  /** So lan goi hong lien tiep tinh den luc nay. */
  private failInRow = 0;

  /** Moc thoi gian duoc goi lai, tinh bang mili giay. */
  private openUntil = 0;

  constructor(config: ConfigService) {
    const key = config.get<string>('ai.apiKey') ?? '';
    this.model = config.get<string>('ai.model') ?? 'claude-opus-5';
    const timeout = config.get<number>('ai.timeoutMs') ?? 45_000;

    this.client =
      key.trim() === ''
        ? null
        : new Anthropic({ apiKey: key, timeout, maxRetries: RETRY });

    this.logger.log(
      this.client
        ? `Dich vu tri tue nhan tao: goi that, mo hinh ${this.model}`
        : 'Dich vu tri tue nhan tao: chua co khoa, chay bang bo tra loi mau',
    );
  }

  /** He thong co dang goi dich vu that hay khong. */
  live(): boolean {
    return this.client !== null && Date.now() >= this.openUntil;
  }

  /**
   * Hoi mo hinh mot cau va lay ve loi van.
   *
   * Khong bao gio nem loi. Goi that khong duoc thi tra ve dau SAMPLE kem ly
   * do, de ben goi thay the bang loi mau cua rieng chuc nang do.
   */
  async ask(request: AiAsk): Promise<AiAnswer> {
    const blocked = this.whyBlocked();
    if (blocked) {
      return { text: '', mode: AiMode.SAMPLE, problem: blocked };
    }

    try {
      const reply = await this.client!.messages.create({
        model: this.model,
        max_tokens: request.maxWords ?? 2000,
        system: request.system,
        messages: [{ role: 'user', content: contentOf(request) }],
      });
      this.failInRow = 0;
      return { text: textOf(reply), mode: AiMode.LIVE, problem: '' };
    } catch (trouble) {
      return { text: '', mode: AiMode.SAMPLE, problem: this.noteFailure(trouble) };
    }
  }

  /**
   * Hoi mo hinh va mong cau tra loi la mot cau truc du lieu.
   *
   * Mo hinh co the keo them loi dan o dau va o cuoi, nen o day cat lay doan
   * nam giua cap ngoac ngoai cung roi moi doc. Doc khong ra thi coi nhu lan
   * goi do hong, va ben goi dung loi mau.
   */
  async askShaped<T>(request: AiAsk): Promise<{ value: T | null; mode: AiMode; problem: string }> {
    const answer = await this.ask(request);
    if (answer.mode === AiMode.SAMPLE) {
      return { value: null, mode: answer.mode, problem: answer.problem };
    }
    const cut = between(answer.text);
    if (!cut) {
      return { value: null, mode: AiMode.SAMPLE, problem: 'Cau tra loi khong dung khuon' };
    }
    try {
      return { value: JSON.parse(cut) as T, mode: AiMode.LIVE, problem: '' };
    } catch {
      return { value: null, mode: AiMode.SAMPLE, problem: 'Cau tra loi khong doc duoc' };
    }
  }

  /** Vi sao chua goi duoc, hoac rong neu goi duoc. */
  private whyBlocked(): string {
    if (!this.client) {
      return NO_KEY;
    }
    return Date.now() < this.openUntil ? BREAK_OPEN : '';
  }

  /**
   * Ghi nhan mot lan goi hong va mo cau dao khi hong lien tiep qua nhieu.
   *
   * Ly do duoc rut gon truoc khi ghi nhat ky, va khong bao gio kem khoa dich
   * vu, vi nhat ky may chu nhieu nguoi doc duoc.
   */
  private noteFailure(trouble: unknown): string {
    const why = shortReason(trouble);
    this.failInRow += 1;
    if (this.failInRow >= BREAK_AFTER) {
      this.openUntil = Date.now() + BREAK_MS;
      this.failInRow = 0;
      this.logger.error(`Ngung goi dich vu ${BREAK_MS / 1000} giay. Lan cuoi hong vi: ${why}`);
      return `${why} (da ngung goi mot luc)`;
    }
    this.logger.warn(`Goi dich vu tri tue nhan tao hong: ${why}`);
    return why;
  }
}

/** Phan noi dung gui di, gom anh truoc roi den cau hoi. */
function contentOf(request: AiAsk): Anthropic.ContentBlockParam[] {
  const out: Anthropic.ContentBlockParam[] = [];
  for (const one of request.picture ?? []) {
    out.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaOf(one.kind), data: one.data },
    });
  }
  out.push({ type: 'text', text: request.prompt });
  return out;
}

/** Bon loai anh dich vu nhan. Loai la khac deu gui di duoi dang anh png. */
function mediaOf(kind: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const low = kind.toLowerCase();
  if (low.includes('jpg') || low.includes('jpeg')) {
    return 'image/jpeg';
  }
  if (low.includes('gif')) {
    return 'image/gif';
  }
  if (low.includes('webp')) {
    return 'image/webp';
  }
  return 'image/png';
}

/** Gop cac doan chu trong cau tra loi lai thanh mot chuoi. */
function textOf(reply: Anthropic.Message): string {
  return reply.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/**
 * Cat lay doan nam giua cap ngoac ngoai cung.
 *
 * Doan nay nhan ca ngoac nhon lan ngoac vuong, vi cau tra loi co the la mot
 * danh sach. Khong tim thay cap nao thi tra ve rong.
 */
function between(raw: string): string {
  const pairs: [string, string][] = [
    ['{', '}'],
    ['[', ']'],
  ];
  let best = '';
  for (const [open, close] of pairs) {
    const from = raw.indexOf(open);
    const to = raw.lastIndexOf(close);
    if (from >= 0 && to > from) {
      const cut = raw.slice(from, to + 1);
      if (cut.length > best.length) {
        best = cut;
      }
    }
  }
  return best;
}

/**
 * Rut gon ly do hong thanh mot dong ngan.
 *
 * Chi giu loai loi va ma trang thai. Khong bao gio chep nguyen loi goc vao
 * nhat ky, vi loi goc co the keo theo noi dung yeu cau da gui di.
 */
function shortReason(trouble: unknown): string {
  if (trouble instanceof Anthropic.APIError) {
    return `Dich vu tra ve ma ${trouble.status ?? 'khong ro'}`;
  }
  if (trouble instanceof Error) {
    return trouble.name === 'AbortError' ? 'Goi dich vu qua lau' : trouble.name;
  }
  return 'Khong ro';
}
