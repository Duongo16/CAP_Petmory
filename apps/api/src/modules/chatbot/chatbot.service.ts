import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { BusinessConfigService } from '../business-config/business-config.service';

/** One answer node. Its score is the sum of the keywords that matched. */
interface AnswerNode {
  code: string;
  keyword: string[];
  /** Builds the answer. Allowed to read live data so it never invents a number. */
  composeAnswer: (ctx: AnswerContext) => Promise<string> | string;
  suggestion: string[];
  path?: string;
}

interface AnswerContext {
  catalog: CatalogService;
  config: BusinessConfigService;
}

export interface Answer {
  code: string;
  content: string;
  suggestion: string[];
  path: string | null;
  /** Tells the UI the assistant did not understand, so it can offer a human. */
  understood: boolean;
}

/** Strips Vietnamese accents so matching does not depend on how the user typed. */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function formatMoney(str: string): string {
  return `${new Intl.NumberFormat('vi-VN').format(Number(str))} VND`;
}

const GENERAL_SUGGESTIONS = ['PRICE', 'LEAD_TIME', 'SIZES', 'MATERIAL', 'PROCESS'];

/**
 * Basic conversational assistant.
 *
 * Calls no language model. Answers are composed from the product catalog and the
 * business settings in the database, so it never invents a price or a lead time.
 * The trade-off is that it only understands common questions; anything outside
 * that range hands the customer over to a person.
 */
@Injectable()
export class ChatbotService {
  private readonly buttons: AnswerNode[] = [
    {
      code: 'GREETING',
      keyword: ['xin chao', 'chao', 'hello', 'hi', 'alo'],
      composeAnswer: () =>
        'Chào bạn. Mình giúp bạn tìm hiểu về sản phẩm thủ công làm từ ảnh thú cưng. Bạn muốn biết gì?',
      suggestion: GENERAL_SUGGESTIONS,
    },
    {
      code: 'PRICE',
      keyword: ['price', 'bao nhieu tien', 'bao nhieu', 'chi phi', 'gia ca', 'mac khong'],
      composeAnswer: async ({ catalog }) => {
        const ds = await catalog.listProductType(true);
        const line = ds.map((kind) => {
          const price = kind.sizes
            .filter((s) => s.enabled)
            .map((s) => BigInt(s.price.toString().split('.')[0]));
          if (price.length === 0) {
            return `· ${kind.name}: đang cập nhật`;
          }
          const lowest = price.reduce((a, b) => (a < b ? a : b));
          const highest = price.reduce((a, b) => (a > b ? a : b));
          const range =
            lowest === highest
              ? formatMoney(lowest.toString())
              : `${formatMoney(lowest.toString())} đến ${formatMoney(highest.toString())}`;
          return `· ${kind.name}: ${range}`;
        });
        return `Giá theo từng loại sản phẩm và kích cỡ:\n${line.join('\n')}\n\nGiá thay đổi theo kích cỡ vì kích cỡ lớn hơn thì làm được nhiều chi tiết hơn.`;
      },
      suggestion: ['SIZES', 'LEAD_TIME', 'PROCESS'],
      path: '/products',
    },
    {
      code: 'LEAD_TIME',
      keyword: ['bao lau', 'thoi gian', 'may ngay', 'khi nao nhan', 'lau khong', 'giao hang'],
      composeAnswer: async ({ catalog, config }) => {
        const ds = await catalog.listProductType(true);
        const day = ds.flatMap((l) => l.sizes.filter((s) => s.enabled).map((s) => s.productionDays));
        const cf = await config.get();
        if (day.length === 0) {
          return 'Thời gian sản xuất đang được cập nhật. Bạn để lại liên hệ, tư vấn viên sẽ báo lại.';
        }
        const min = Math.min(...day);
        const max = Math.max(...day);
        return `Thời gian làm từ ${min} đến ${max} ngày tùy kích cỡ, cộng khoảng ${cf.estimatedShippingDays} ngày vận chuyển. Vì là hàng làm tay từng cái một nên không rút ngắn được nhiều.`;
      },
      suggestion: ['PRICE', 'PROCESS'],
    },
    {
      code: 'SIZES',
      keyword: ['kich co', 'kich thuoc', 'size', 'to nho', 'bao to', 'cao bao nhieu'],
      composeAnswer: async ({ catalog }) => {
        const ds = await catalog.listProductType(true);
        const line = ds.flatMap((kind) =>
          kind.sizes
            .filter((s) => s.enabled)
            .map((s) => `· ${kind.name} — ${s.displayName}: ${s.dimensions}`),
        );
        return `Các kích cỡ đang có:\n${line.join('\n')}\n\nKích cỡ lớn hơn thể hiện được nhiều chi tiết hơn, ví dụ các đốm lông nhỏ và biểu cảm mắt.`;
      },
      suggestion: ['PRICE', 'MATERIAL'],
      path: '/products',
    },
    {
      code: 'MATERIAL',
      keyword: ['chat lieu', 'lam bang gi', 'vai gi', 'nguyen lieu', 'tai che'],
      composeAnswer: async ({ catalog }) => {
        const ds = await catalog.listProductType(true);
        const line = [...new Set(ds.map((l) => l.material).filter(Boolean))];
        return `Sản phẩm làm thủ công từ ${line.join(', ').toLowerCase()}. Mỗi món một bản, không cái nào giống cái nào.`;
      },
      suggestion: ['PRICE', 'PROCESS'],
    },
    {
      code: 'PROCESS',
      keyword: ['quy trinh', 'dat hang', 'mua hang', 'cach dat', 'lam sao de', 'buoc nao', 'cach mua'],
      composeAnswer: () =>
        'Bốn bước:\n1. Tải ảnh thú cưng lên, nên đủ bốn góc để xưởng nhìn được toàn bộ chi tiết\n2. Tùy biến mẫu, đổi màu từng phần\n3. Chọn kích cỡ rồi thanh toán bằng mã QR\n4. Xưởng làm tay rồi gửi tận nơi',
      suggestion: ['PHOTO', 'PAYMENT', 'PRICE'],
      path: '/studio',
    },
    {
      code: 'PHOTO',
      keyword: ['photo', 'hinh', 'capture', 'upload', 'tai anh', 'anh mo', 'anh cu', 'may goc'],
      composeAnswer: () =>
        'Bạn tải ảnh định dạng JPG hoặc PNG. Nên chụp đủ bốn góc là chính diện, nghiêng trái, nghiêng phải và phía sau, để nghệ nhân nhìn được toàn bộ chi tiết.\n\nẢnh cũ hoặc hơi mờ thì hệ thống có chức năng phục hồi giúp làm nét và chỉnh sáng. Nếu chỉ còn vài tấm thì vẫn đặt được, xưởng sẽ liên hệ trao đổi thêm.',
      suggestion: ['PROCESS', 'LEAD_TIME'],
      path: '/pets',
    },
    {
      code: 'PAYMENT',
      keyword: ['thanh toan', 'tra tien', 'chuyen khoan', 'qr', 'coc', 'dat coc', 'tra gop'],
      composeAnswer: () =>
        'Thanh toán một lần toàn bộ giá sản phẩm bằng mã QR chuyển khoản. Không đặt cọc, không chia nhiều đợt.\n\nPhí vận chuyển do đơn vị giao hàng thu trực tiếp khi giao, không nằm trong số tiền này.',
      suggestion: ['PRICE', 'PROCESS'],
    },
    {
      code: 'MEMORIAL',
      keyword: ['da mat', 'qua doi', 'mat roi', 'khong con', 'tuong nho', 'ky niem'],
      composeAnswer: () =>
        'Mình rất tiếc về sự mất mát của bạn.\n\nRất nhiều khách đến với PETMORY trong hoàn cảnh này. Bạn chỉ cần những tấm ảnh còn giữ được, kể cả ảnh cũ hay hơi mờ, hệ thống có chức năng phục hồi. Nếu ảnh không đủ bốn góc thì vẫn làm được, xưởng sẽ trao đổi thêm với bạn.',
      suggestion: ['PHOTO', 'SIZES'],
      path: '/pets',
    },
    {
      code: 'VET',
      keyword: ['benh', 'om', 'thuoc', 'bac si', 'thu y', 'not', 'kham'],
      composeAnswer: () =>
        'Phần này ngoài chuyên môn của mình. Bạn nên đưa bé tới bác sĩ thú y để được khám và tư vấn đúng.\n\nPETMORY chỉ làm sản phẩm thủ công từ ảnh thú cưng.',
      suggestion: GENERAL_SUGGESTIONS,
    },
    {
      code: 'MERCHANDISE',
      keyword: ['ban do an', 'thuc an', 'vong co that', 'do choi', 'phu kien that', 'ban gi khac'],
      composeAnswer: () =>
        'PETMORY không bán thức ăn, phụ kiện hay đồ dùng cho thú cưng.\n\nBên mình chỉ làm một thứ: sản phẩm thủ công độc bản từ ảnh thú cưng của bạn.',
      suggestion: ['PRICE', 'PROCESS'],
    },
  ];

  constructor(
    private readonly catalog: CatalogService,
    private readonly config: BusinessConfigService,
  ) {}

  async ask(question: string): Promise<Answer> {
    const prepare = normalize(question);
    const node = this.findNodeBestMatch(prepare);

    if (!node) {
      return {
        code: 'UNKNOWN',
        content:
          'Mình chưa hiểu ý bạn. Bạn thử hỏi về giá, kích cỡ, thời gian làm, chất liệu hoặc cách đặt hàng.\n\nNếu cần trao đổi kỹ hơn, bạn để lại số điện thoại, tư vấn viên sẽ gọi lại.',
        suggestion: GENERAL_SUGGESTIONS,
        path: null,
        understood: false,
      };
    }

    return {
      code: node.code,
      content: await node.composeAnswer({ catalog: this.catalog, config: this.config }),
      suggestion: node.suggestion,
      path: node.path ?? null,
      understood: true,
    };
  }

  /** Suggested questions shown when the chat panel first opens. */
  getInitialSuggestions(): string[] {
    return GENERAL_SUGGESTIONS;
  }

  /**
   * Picks the node with the strongest keyword match. Longer keywords win, so
   * "da mat" beats a plain "mat" appearing inside other phrases.
   */
  private findNodeBestMatch(prepare: string): AnswerNode | null {
    let best: AnswerNode | null = null;
    let bestScore = 0;

    for (const node of this.buttons) {
      let point = 0;
      for (const word of node.keyword) {
        if (prepare.includes(word)) {
          point += word.length;
        }
      }
      if (point > bestScore) {
        bestScore = point;
        best = node;
      }
    }
    return best;
  }
}
