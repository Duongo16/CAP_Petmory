import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { BusinessConfigService } from '../business-config/business-config.service';
import { GoodsService } from '../goods/goods.service';
import { KnowledgeService, plain } from './knowledge.service';
import { AssistantKnowledgeDocument } from './schemas/assistant-knowledge.schema';

/**
 * Dieu tro ly dang nho trong mot phien: san pham vua duoc nhac toi va muc vua
 * tra loi. Nho vay cau hoi tiep theo kieu "con co lon thi sao" van hieu dung.
 */
export interface ChatFocus {
  productTypeCode: string;
  lastCode: string;
}

export interface Answer {
  code: string;
  content: string;
  /** Cac cau hoi goi y tiep theo, viet san de hien thang len nut. */
  suggestion: string[];
  path: string | null;
  /** Bao cho giao dien biet tro ly khong hieu, de moi gap tu van vien. */
  understood: boolean;
  focus: ChatFocus;
}

/** Mot loai san pham tuy bien, rut gon cho viec tra loi. */
interface Kind {
  code: string;
  name: string;
  material: string;
  /** Cac cach goi ngan, da bo dau, de nhan ra trong cau hoi. */
  alias: string[];
  sizes: { name: string; dimensions: string; price: bigint; days: number }[];
}

/** Cau hoi ngan toi muc nay thi duoc coi la hoi tiep y truoc. */
const FOLLOW_UP_WORDS = 8;

/** Dau hieu cua mot cau hoi noi tiep cau truoc. */
const FOLLOW_UP_HINTS = ['thi sao', 'con ', 'the con', 'vay con', 'loai do', 'cai do', 'mau do'];

const NO_FOCUS: ChatFocus = { productTypeCode: '', lastCode: '' };

const UNKNOWN_WORDS =
  'Mình chưa hiểu ý bạn. Bạn thử hỏi về giá, kích cỡ, thời gian làm, cách đặt hàng hoặc sản phẩm có sẵn nhé. Nếu cần trao đổi kỹ hơn, bạn bấm "Gặp tư vấn viên".';

function money(value: bigint): string {
  return `${new Intl.NumberFormat('vi-VN').format(value)} VND`;
}

function wholeOf(raw: unknown): bigint {
  return BigInt(String(raw ?? '0').split('.')[0] || '0');
}

/**
 * Tro ly ban co ban.
 *
 * Khong goi mo hinh ngon ngu nao. Cau tra loi lay tu kho tri thuc do nhom Quan
 * ly soan, va moi con so (gia, kich co, thoi gian) duoc dien vao tu danh muc
 * that luc tra loi, nen khong bao gio bia ra mot con so.
 */
@Injectable()
export class ChatbotService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly config: BusinessConfigService,
    private readonly goods: GoodsService,
    private readonly knowledge: KnowledgeService,
  ) {}

  async ask(question: string, focus: ChatFocus = NO_FOCUS): Promise<Answer> {
    const said = plain(question);
    const [rows, kinds] = await Promise.all([this.knowledge.active(), this.kinds()]);

    const mentioned = kinds.find((kind) => kind.alias.some((one) => said.includes(one)));
    const product = mentioned?.code ?? focus.productTypeCode;

    let entry = bestMatch(rows, said);
    if (!entry && looksLikeFollowUp(said) && focus.lastCode) {
      entry = rows.find((one) => one.code === focus.lastCode) ?? null;
    }

    if (!entry && mentioned) {
      return {
        code: 'PRODUCT_INFO',
        content: this.describe(mentioned),
        suggestion: await this.starters(rows),
        path: `/shop?tab=custom&product=${mentioned.code}`,
        understood: true,
        focus: { productTypeCode: mentioned.code, lastCode: focus.lastCode },
      };
    }

    if (!entry) {
      return {
        code: 'UNKNOWN',
        content: UNKNOWN_WORDS,
        suggestion: await this.starters(rows),
        path: null,
        understood: false,
        focus: { productTypeCode: product, lastCode: focus.lastCode },
      };
    }

    const chosen = kinds.filter((kind) => !product || kind.code === product);
    return {
      code: entry.code,
      content: await this.fill(entry.answer, chosen.length > 0 ? chosen : kinds),
      suggestion: entry.followUp
        .map((code) => rows.find((one) => one.code === code)?.question)
        .filter((one): one is string => Boolean(one)),
      path: entry.link || null,
      understood: true,
      focus: { productTypeCode: product, lastCode: entry.code },
    };
  }

  /** Cac cau hoi hien san khi khach vua mo khung chat. */
  async suggestions(): Promise<string[]> {
    return this.starters(await this.knowledge.active());
  }

  /** Cac muc hoi dap dang bat, de dua vao loi dan cho mo hinh ngon ngu. */
  async knowledgeText(): Promise<string> {
    const [rows, kinds] = await Promise.all([this.knowledge.active(), this.kinds()]);
    const parts: string[] = [];
    for (const one of rows) {
      parts.push(`Hỏi: ${one.question}\nĐáp: ${await this.fill(one.answer, kinds)}`);
    }
    return parts.join('\n\n');
  }

  private async starters(rows: AssistantKnowledgeDocument[]): Promise<string[]> {
    return rows.filter((one) => one.starter).slice(0, 6).map((one) => one.question);
  }

  /**
   * Dien cac o co san trong cau tra loi bang so lieu that.
   *
   * Khi khach dang hoi ve mot san pham cu the thi bang gia, kich co va thoi
   * gian chi noi ve san pham do.
   */
  private async fill(text: string, kinds: Kind[]): Promise<string> {
    if (!text.includes('{{')) {
      return text;
    }
    const cf = await this.config.get();
    const values: Record<string, () => Promise<string> | string> = {
      BANG_GIA: () => priceTable(kinds),
      KICH_CO: () => sizeTable(kinds),
      THOI_GIAN: () => leadTime(kinds, cf.estimatedShippingDays),
      CHAT_LIEU: () => {
        const list = [...new Set(kinds.map((kind) => kind.material).filter(Boolean))];
        return list.length > 0 ? list.join(', ').toLowerCase() : 'len chọc thủ công';
      },
      SO_NGAY_GIAO: () => String(cf.estimatedShippingDays),
      HANG_CO_SAN: () => this.goodsTable(),
    };
    let out = text;
    for (const [name, make] of Object.entries(values)) {
      const slot = `{{${name}}}`;
      if (out.includes(slot)) {
        out = out.split(slot).join(await make());
      }
    }
    return out;
  }

  private describe(kind: Kind): string {
    const sizes = kind.sizes.map((one) => `· ${one.name} (${one.dimensions}): ${money(one.price)}, làm trong ${one.days} ngày`);
    return sizes.length > 0
      ? `${kind.name}:\n${sizes.join('\n')}\n\nBạn có thể tự phối màu cho bé trong Studio 3D trước khi đặt.`
      : `${kind.name} đang được cập nhật giá. Bạn bấm "Gặp tư vấn viên" để được báo giá nhé.`;
  }

  private async goodsTable(): Promise<string> {
    const page = await this.goods.list({ page: 1 });
    const lines = page.rows.map((one) => {
      const prices = one.variant.filter((each) => each.enabled).map((each) => wholeOf(each.price));
      const low = prices.reduce((a: bigint | null, b) => (a === null || b < a ? b : a), null);
      return `· ${one.name}: ${low === null ? 'đang cập nhật' : `từ ${money(low)}`}`;
    });
    return lines.length > 0 ? lines.join('\n') : '· Hiện chưa có món nào';
  }

  private async kinds(): Promise<Kind[]> {
    const list = await this.catalog.listProductType(true);
    return list.map((kind) => {
      const name = plain(kind.name);
      const words = name.split(' ');
      return {
        code: kind.code,
        name: kind.name,
        material: kind.material ?? '',
        alias: [...new Set([name, words.slice(0, 2).join(' ')].filter((one) => one.length >= 5))],
        sizes: kind.sizes
          .filter((size) => size.enabled)
          .map((size) => ({
            name: size.displayName,
            dimensions: size.dimensions,
            price: wholeOf(size.price),
            days: size.productionDays,
          })),
      };
    });
  }
}

/**
 * Chon muc khop nhat. Tu khoa dai duoc tinh diem cao hon, nen "da mat" thang
 * mot chu "mat" tinh co nam trong cau khac.
 */
function bestMatch(rows: AssistantKnowledgeDocument[], said: string): AssistantKnowledgeDocument | null {
  let best: AssistantKnowledgeDocument | null = null;
  let bestScore = 0;
  for (const one of rows) {
    let score = 0;
    for (const word of one.keywords) {
      if (word && said.includes(word)) {
        score += word.length;
      }
    }
    if (plain(one.question) === said) {
      score += 100;
    }
    if (score > bestScore) {
      bestScore = score;
      best = one;
    }
  }
  return best;
}

function looksLikeFollowUp(said: string): boolean {
  return said.split(' ').length <= FOLLOW_UP_WORDS && FOLLOW_UP_HINTS.some((hint) => said.includes(hint));
}

function priceTable(kinds: Kind[]): string {
  return kinds
    .map((kind) => {
      if (kind.sizes.length === 0) {
        return `· ${kind.name}: đang cập nhật`;
      }
      const prices = kind.sizes.map((one) => one.price);
      const low = prices.reduce((a, b) => (a < b ? a : b));
      const high = prices.reduce((a, b) => (a > b ? a : b));
      return `· ${kind.name}: ${low === high ? money(low) : `${money(low)} đến ${money(high)}`}`;
    })
    .join('\n');
}

function sizeTable(kinds: Kind[]): string {
  return kinds
    .flatMap((kind) => kind.sizes.map((one) => `· ${kind.name} — ${one.name}: ${one.dimensions}, ${money(one.price)}`))
    .join('\n');
}

function leadTime(kinds: Kind[], shipping: number): string {
  const days = kinds.flatMap((kind) => kind.sizes.map((one) => one.days));
  if (days.length === 0) {
    return 'đang được cập nhật';
  }
  const low = Math.min(...days);
  const high = Math.max(...days);
  const make = low === high ? `${low} ngày` : `${low} đến ${high} ngày`;
  return `${make} làm tay, cộng khoảng ${shipping} ngày vận chuyển`;
}
