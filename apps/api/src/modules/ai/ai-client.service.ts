import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ApiError, FinishReason, GoogleGenAI, Part } from '@google/genai';
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

const PROVIDER_GEMINI = 'gemini';
const PROVIDER_ANTHROPIC = 'anthropic';

/** Mo hinh mac dinh cua tung nha cung cap, khi khong dat AI_MODEL. */
const MODEL_DEFAULT: Record<string, string> = {
  [PROVIDER_GEMINI]: 'gemini-2.5-flash',
  [PROVIDER_ANTHROPIC]: 'claude-opus-5',
};

/** Do dai toi da mac dinh cua cau tra loi. */
const WORDS_DEFAULT = 2000;

/** Cau tra loi bi dich vu chan vi ly do an toan noi dung. */
class BlockedAnswer extends Error {
  constructor() {
    super('blocked');
    this.name = 'BlockedAnswer';
  }
}

/** Mot cach goi ra mot nha cung cap cu the. */
interface ModelCaller {
  readonly provider: string;
  call(request: AiAsk, model: string): Promise<string>;
}

/** Goi Claude qua thu vien chinh thuc cua Anthropic. */
class AnthropicCaller implements ModelCaller {
  readonly provider = PROVIDER_ANTHROPIC;
  private readonly client: Anthropic;

  constructor(key: string, timeout: number) {
    this.client = new Anthropic({ apiKey: key, timeout, maxRetries: RETRY });
  }

  async call(request: AiAsk, model: string): Promise<string> {
    const reply = await this.client.messages.create({
      model,
      max_tokens: request.maxWords ?? WORDS_DEFAULT,
      system: request.system,
      messages: [{ role: 'user', content: anthropicContent(request) }],
    });
    return reply.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
  }
}

/** Goi Gemini qua thu vien chinh thuc cua Google. */
class GeminiCaller implements ModelCaller {
  readonly provider = PROVIDER_GEMINI;
  private readonly client: GoogleGenAI;

  constructor(key: string, timeout: number) {
    this.client = new GoogleGenAI({ apiKey: key, httpOptions: { timeout } });
  }

  async call(request: AiAsk, model: string): Promise<string> {
    const parts: Part[] = (request.picture ?? []).map((one) => ({
      inlineData: { mimeType: mediaOf(one.kind), data: one.data },
    }));
    parts.push({ text: request.prompt });

    const reply = await this.client.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: request.system,
        maxOutputTokens: request.maxWords ?? WORDS_DEFAULT,
        temperature: 0.6,
        // Dong flash tra loi nhanh hon khi tat buoc suy nghi rieng; dong pro khong cho tat.
        ...(model.includes('flash') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    });

    const reason = reply.candidates?.[0]?.finishReason;
    if (reply.promptFeedback?.blockReason || reason === FinishReason.SAFETY) {
      throw new BlockedAnswer();
    }
    return (reply.text ?? '').trim();
  }
}

/**
 * Cho duy nhat trong he thong goi ra dich vu mo hinh ngon ngu.
 *
 * Moi chuc nang dung tri tue nhan tao deu di qua day, nen nha cung cap, thoi
 * gian cho, so lan thu lai va cau dao chi phai dat mot cho. Nha cung cap chon
 * bang AI_PROVIDER; de trong thi chon theo khoa dang co, uu tien Gemini. Khoa
 * doc tu bien moi truong va khong bao gio duoc ghi ra nhat ky hay tra ve.
 *
 * Khong lan goi nao o day nem loi ra ngoai. Khi dich vu that khong dung duoc,
 * ket qua tra ve mang dau SAMPLE kem ly do, va ben goi tu quyet dinh dung loi
 * mau nao. Nho vay mot su co ben ngoai khong lam hong chuc nang chinh.
 */
@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);
  private readonly caller: ModelCaller | null;
  private readonly model: string;

  /** So lan goi hong lien tiep tinh den luc nay. */
  private failInRow = 0;

  /** Moc thoi gian duoc goi lai, tinh bang mili giay. */
  private openUntil = 0;

  constructor(config: ConfigService) {
    const timeout = config.get<number>('ai.timeoutMs') ?? 45_000;
    const keys: Record<string, string> = {
      [PROVIDER_GEMINI]: (config.get<string>('ai.geminiKey') ?? '').trim(),
      [PROVIDER_ANTHROPIC]: (config.get<string>('ai.apiKey') ?? '').trim(),
    };
    const wanted = config.get<string>('ai.provider') ?? '';
    const provider =
      wanted in keys ? wanted : keys[PROVIDER_ANTHROPIC] && !keys[PROVIDER_GEMINI] ? PROVIDER_ANTHROPIC : PROVIDER_GEMINI;
    const key = keys[provider];

    this.model = config.get<string>('ai.model') || MODEL_DEFAULT[provider];
    if (!key) {
      this.caller = null;
    } else if (provider === PROVIDER_GEMINI) {
      this.caller = new GeminiCaller(key, timeout);
    } else {
      this.caller = new AnthropicCaller(key, timeout);
    }

    this.logger.log(
      this.caller
        ? `Dich vu tri tue nhan tao: goi that qua ${provider}, mo hinh ${this.model}`
        : `Dich vu tri tue nhan tao: chua co khoa ${provider}, chay bang bo tra loi mau`,
    );
  }

  /** He thong co dang goi dich vu that hay khong. */
  live(): boolean {
    return this.caller !== null && Date.now() >= this.openUntil;
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
      const text = await this.caller!.call(request, this.model);
      this.failInRow = 0;
      return { text, mode: AiMode.LIVE, problem: '' };
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
    if (!this.caller) {
      return NO_KEY;
    }
    return Date.now() < this.openUntil ? BREAK_OPEN : '';
  }

  /**
   * Ghi nhan mot lan goi hong va mo cau dao khi hong lien tiep qua nhieu.
   *
   * Ly do duoc rut gon truoc khi ghi nhat ky, va khong bao gio kem khoa dich
   * vu, vi nhat ky may chu nhieu nguoi doc duoc. Cau tra loi bi chan vi an toan
   * khong tinh la dich vu hong, nen khong day cau dao.
   */
  private noteFailure(trouble: unknown): string {
    const why = shortReason(trouble);
    if (trouble instanceof BlockedAnswer) {
      this.logger.warn(`Cau tra loi bi chan: ${why}`);
      return why;
    }
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

/** Phan noi dung gui cho Claude, gom anh truoc roi den cau hoi. */
function anthropicContent(request: AiAsk): Anthropic.ContentBlockParam[] {
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
  if (trouble instanceof BlockedAnswer) {
    return 'Cau tra loi bi dich vu chan vi ly do an toan noi dung';
  }
  const status =
    trouble instanceof Anthropic.APIError
      ? trouble.status
      : trouble instanceof ApiError
        ? trouble.status
        : undefined;
  if (status === 429) {
    return 'Dich vu bao het han muc hoac goi qua nhanh (429)';
  }
  if (status !== undefined) {
    return `Dich vu tra ve ma ${status ?? 'khong ro'}`;
  }
  if (trouble instanceof Error) {
    return trouble.name === 'AbortError' ? 'Goi dich vu qua lau' : trouble.name;
  }
  return 'Khong ro';
}
