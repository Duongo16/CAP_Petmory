import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  CHAT_NEXT,
  ChatSession,
  ChatSessionDocument,
  ChatSide,
  ChatState,
  ChatTurn,
} from './schemas/chat-session.schema';
import { ChatbotService } from './chatbot.service';
import { AiClientService } from '../ai/ai-client.service';
import { AiQuotaService } from '../ai/ai-quota.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { AiKind, AiMode } from '../ai/schemas/ai-usage.schema';
import { CatalogService } from '../catalog/catalog.service';
import { GoodsService } from '../goods/goods.service';
import { MSG } from '../../common/constants/messages';

/** Bao nhieu luot noi gan nhat duoc giu lai trong mot phien. */
const TURN_KEEP = 40;

/** Bao nhieu luot gan nhat duoc nhac lai cho dich vu khi hoi tiep. */
const TURN_RECALL = 12;

/** Loi chao dau phien. */
const HELLO =
  'Chào bạn. Mình giúp bạn tìm hiểu về sản phẩm thủ công làm từ ảnh thú cưng. Bạn muốn biết gì?';

/** Loi bao khi phien dang cho mot nhan vien. */
const WAITING_WORDS =
  'Mình đã chuyển cuộc trò chuyện sang tư vấn viên. Bạn chờ một chút nhé, tin nhắn của bạn vẫn được lưu lại.';

/** Loi bao khi phien da khep lai. */
const CLOSED_WORDS = 'Cuộc trò chuyện này đã kết thúc. Bạn mở cuộc mới để hỏi tiếp nhé.';

/**
 * Hoi thoai ban day du.
 *
 * Khac ban co ban o ba cho: nho lai nhung gi da noi trong cung mot phien, goi
 * y san pham that lay tu danh muc dang ban, va chuyen duoc sang nguoi that khi
 * khach muon gap nguoi.
 *
 * Khi chua co khoa dich vu, hoac khi goi dich vu that khong duoc, phien van
 * chay bang bo tra loi theo tu khoa cua ban co ban. Khach van duoc tra loi,
 * chi la cau tra loi khong nho ngu canh. Hai duong deu chuyen sang nguoi that
 * duoc nhu nhau.
 */
@Injectable()
export class ChatSessionService {
  constructor(
    @InjectModel(ChatSession.name) private readonly model: Model<ChatSessionDocument>,
    private readonly basic: ChatbotService,
    private readonly client: AiClientService,
    private readonly quota: AiQuotaService,
    private readonly usage: AiUsageService,
    private readonly catalog: CatalogService,
    private readonly goods: GoodsService,
  ) {}

  /** Mo mot phien moi cho nguoi dang dang nhap. */
  async open(owner: string | null): Promise<ChatSessionDocument> {
    const starters = await this.basic.suggestions();
    return this.model.create({
      code: `${randomUUID()}${randomUUID().replace(/-/g, '')}`,
      owner: owner ? new Types.ObjectId(owner) : null,
      state: ChatState.BOT,
      turn: [
        {
          side: ChatSide.BOT,
          text: HELLO,
          suggestion: starters,
          path: '',
          productCode: [],
          goodsCode: [],
          at: new Date(),
        },
      ],
      lastAt: new Date(),
    });
  }

  /**
   * Phien dang mo gan nhat cua mot nguoi da dang nhap.
   *
   * Co cho nay thi mo lai trang khong lam mat mach hoi thoai, ma khong phai
   * giu ma phien trong trinh duyet. Khach chua dang nhap khong co gi de tim,
   * va phien cua ho ket thuc cung phien lam viec.
   */
  latestOf(owner: string): Promise<ChatSessionDocument | null> {
    return this.model
      .findOne({
        owner: new Types.ObjectId(owner),
        state: { $ne: ChatState.CLOSED },
      })
      .sort({ lastAt: -1 })
      .exec();
  }

  /**
   * Doc mot phien.
   *
   * Chi chu phien moi doc duoc, ke ca khi nguoi khac biet ma phien. Phien cu
   * cua khach vang lai khong co chu nen khong ai doc lai duoc nua.
   */
  async findFor(code: string, owner: string | null): Promise<ChatSessionDocument> {
    const one = await this.model.findOne({ code }).exec();
    if (!one || !owner || one.owner?.toString() !== owner) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return one;
  }

  /**
   * Khach noi mot cau.
   *
   * Khi phien dang cho nguoi hoac dang do nguoi tra loi, cau hoi chi duoc luu
   * lai chu may khong chen vao giua, de khach khong nhan hai cau tra loi khac
   * nhau cho cung mot cau hoi.
   */
  async ask(code: string, owner: string | null, question: string): Promise<ChatSessionDocument> {
    const one = await this.findFor(code, owner);
    if (one.state === ChatState.CLOSED) {
      throw new BadRequestException(CLOSED_WORDS);
    }

    this.push(one, { side: ChatSide.USER, text: question });

    if (one.state === ChatState.BOT) {
      const answer = await this.answer(one, owner, question);
      this.push(one, { side: ChatSide.BOT, ...answer });
    } else {
      this.push(one, { side: ChatSide.BOT, text: WAITING_WORDS });
    }

    one.lastAt = new Date();
    return one.save();
  }

  /** Khach xin gap nguoi that. */
  async handover(code: string, owner: string | null, note: string): Promise<ChatSessionDocument> {
    const one = await this.findFor(code, owner);
    this.moveTo(one, ChatState.WAITING);
    one.handoverNote = note.slice(0, 500);
    this.push(one, { side: ChatSide.BOT, text: WAITING_WORDS });
    one.lastAt = new Date();
    return one.save();
  }

  /** Cac phien dang cho hoac dang duoc tra loi, cho trang truc. */
  waitingList() {
    return this.model
      .find({ state: { $in: [ChatState.WAITING, ChatState.WITH_STAFF] } })
      .sort({ lastAt: 1 })
      .limit(100)
      .populate('owner', 'fullName email')
      .populate('staff', 'fullName')
      .exec();
  }

  /** Nhan vien mo mot phien de doc. */
  async readAsStaff(code: string): Promise<ChatSessionDocument> {
    const one = await this.model
      .findOne({ code })
      .populate('owner', 'fullName email')
      .populate('staff', 'fullName')
      .exec();
    if (!one) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return one;
  }

  /** Nhan vien nhan mot phien dang cho. */
  async take(code: string, staff: string): Promise<ChatSessionDocument> {
    const one = await this.model.findOne({ code }).exec();
    if (!one) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    this.moveTo(one, ChatState.WITH_STAFF);
    one.staff = new Types.ObjectId(staff);
    one.lastAt = new Date();
    return one.save();
  }

  /**
   * Nhan vien tra loi.
   *
   * Chi nguoi da nhan phien moi tra loi duoc. Khong kiem cho nay thi hai nhan
   * vien cung tra loi mot khach va hai cau tra loi co the nguoc nhau.
   */
  async reply(code: string, staff: string, text: string): Promise<ChatSessionDocument> {
    const one = await this.model.findOne({ code }).exec();
    if (!one) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    if (one.state !== ChatState.WITH_STAFF) {
      throw new BadRequestException('Phiên này chưa được nhận');
    }
    if (one.staff?.toString() !== staff) {
      throw new ForbiddenException('Phiên này do người khác đang nhận');
    }
    this.push(one, { side: ChatSide.STAFF, text });
    one.lastAt = new Date();
    return one.save();
  }

  /** Khep mot phien lai. */
  async close(code: string, staff: string): Promise<ChatSessionDocument> {
    const one = await this.model.findOne({ code }).exec();
    if (!one) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    if (one.staff && one.staff.toString() !== staff) {
      throw new ForbiddenException('Phiên này do người khác đang nhận');
    }
    this.moveTo(one, ChatState.CLOSED);
    one.lastAt = new Date();
    return one.save();
  }

  /**
   * Doi trang thai theo dung bang cac buoc da cho phep.
   *
   * Khong dat thang thuoc tinh o bat ky cho nao khac, de mot phien khong the
   * nhay tu dang do may tra loi sang dang do nguoi tra loi ma khong qua hang
   * cho.
   */
  private moveTo(one: ChatSessionDocument, wanted: ChatState): void {
    if (one.state === wanted) {
      return;
    }
    if (!CHAT_NEXT[one.state].includes(wanted)) {
      throw new BadRequestException(`Không chuyển được từ ${one.state} sang ${wanted}`);
    }
    one.state = wanted;
  }

  /** Them mot luot noi va cat bot cac luot qua cu. */
  private push(one: ChatSessionDocument, turn: Partial<ChatTurn> & { side: ChatSide; text: string }) {
    one.turn.push({
      side: turn.side,
      text: turn.text.slice(0, 4000),
      suggestion: turn.suggestion ?? [],
      path: turn.path ?? '',
      productCode: turn.productCode ?? [],
      goodsCode: turn.goodsCode ?? [],
      at: new Date(),
    });
    if (one.turn.length > TURN_KEEP) {
      one.turn.splice(0, one.turn.length - TURN_KEEP);
    }
  }

  /**
   * Soan cau tra loi cho mot cau hoi.
   *
   * Thu goi dich vu that truoc. Khong goi duoc thi quay ve bo tra loi theo tu
   * khoa cua ban co ban, nen khach luon co cau tra loi.
   */
  private async answer(
    one: ChatSessionDocument,
    owner: string | null,
    question: string,
  ): Promise<{
    text: string;
    suggestion: string[];
    path: string;
    productCode: string[];
    goodsCode: string[];
  }> {
    const live = await this.tryService(one, owner, question);
    if (live) {
      return live;
    }
    const basic = await this.basic.ask(question, {
      productTypeCode: one.focus?.productTypeCode ?? '',
      lastCode: one.focus?.lastCode ?? '',
    });
    one.focus = basic.focus;
    // Khong co AI van goi y the san pham (muc 18): do ten san pham va hang co san
    // trong cau hoi va cau tra loi, cong voi san pham dang duoc noi toi trong phien.
    const shop = await this.shopWords();
    return {
      text: basic.content,
      suggestion: basic.suggestion,
      path: basic.path ?? '',
      ...cardsFor(`${question}
${basic.content}`, basic.focus.productTypeCode, shop),
    };
  }

  /**
   * Goi dich vu that, kem ngu canh cua phien va danh muc that.
   *
   * Tra ve rong khi chua co khoa, khi het han muc, hoac khi goi hong. Han muc
   * chi bi tru khi that su goi duoc, vi lan quay ve bo tra loi theo tu khoa
   * khong ton mot dong nao.
   */
  private async tryService(
    one: ChatSessionDocument,
    owner: string | null,
    question: string,
  ): Promise<{
    text: string;
    suggestion: string[];
    path: string;
    productCode: string[];
    goodsCode: string[];
  } | null> {
    if (!this.client.live() || !owner) {
      return null;
    }

    const held = await this.quota.hold(owner, AiKind.CHAT_REPLY).catch(() => null);
    if (!held) {
      return null;
    }

    /*
     * Do kho tri thuc song song voi luc goi mo hinh: cau tra loi lay loi van
     * cua mo hinh, nhung nut dan huong, cau goi y tiep va dieu dang nho trong
     * phien van lay tu muc kho khop nhat, de hai che do hanh xu giong nhau.
     */
    const focus = { productTypeCode: one.focus?.productTypeCode ?? '', lastCode: one.focus?.lastCode ?? '' };
    const [shop, known, guide] = await Promise.all([
      this.shopWords(),
      this.basic.knowledgeText(),
      this.basic.ask(question, focus),
    ]);
    const answer = await this.client.ask({
      system: systemWords(),
      prompt: [
        'KHO TRI THỨC CỦA CỬA HÀNG (chính sách và câu trả lời chuẩn):',
        known,
        '',
        'DANH MỤC ĐANG BÁN:',
        shop.text,
        '',
        'Cuộc trò chuyện đến lúc này:',
        recallWords(one),
        '',
        `Câu hỏi mới: ${question}`,
      ].join('\n'),
      maxWords: 1200,
    });

    if (answer.mode !== AiMode.LIVE || answer.text.trim() === '') {
      await this.quota.release(held);
      return null;
    }

    await this.usage.record(
      AiKind.CHAT_REPLY,
      owner,
      AiMode.LIVE,
      one.code,
      '',
    );
    one.focus = guide.focus;
    return {
      text: answer.text.trim(),
      suggestion: guide.understood && guide.suggestion.length > 0 ? guide.suggestion : await this.basic.suggestions(),
      path: guide.understood ? guide.path ?? '' : '',
      productCode: pickCodes(answer.text, shop.kinds),
      goodsCode: pickCodes(answer.text, shop.goods),
    };
  }

  /**
   * Danh muc that, viet gon lai de dua vao loi dan.
   *
   * Gui danh muc that thay vi de dich vu tu nghi ra, de khong bao gio co
   * chuyen gioi thieu mot mon hang cua hang khong ban.
   */
  private async shopWords(): Promise<ShopWords> {
    const kind = await this.catalog.listProductType(true);
    const ready = await this.goods.list({ page: 1 });

    const kindLine = kind.map((one) => {
      const size = one.sizes
        .filter((each) => each.enabled)
        .map((each) => `${each.displayName} ${asDong(each.price.toString())}`)
        .join(', ');
      return `${one.code}: ${one.name} — ${size || 'đang cập nhật'}`;
    });
    const goodsLine = ready.rows.map((one) => {
      const cheapest = one.variant
        .filter((each) => each.enabled)
        .map((each) => BigInt(each.price.toString().split('.')[0]))
        .reduce((a: bigint | null, b) => (a === null || b < a ? b : a), null);
      return `${one.code}: ${one.name} — từ ${cheapest === null ? 'đang cập nhật' : asDong(cheapest.toString())}`;
    });

    return {
      text: [
        'Sản phẩm thủ công làm theo ảnh thú cưng:',
        ...kindLine,
        'Sản phẩm có sẵn bán kèm:',
        ...goodsLine,
      ].join('\n'),
      kinds: kind.map((one) => ({ code: one.code, name: one.name })),
      goods: ready.rows.map((one) => ({ code: one.code, name: one.name })),
    };
  }
}

/** Mot mon trong danh muc: ma de luu, ten de nhan ra trong cau tra loi. */
interface Named {
  code: string;
  name: string;
}

/** Danh muc that, kem cac ma de doi chieu lai cau tra loi. */
interface ShopWords {
  text: string;
  kinds: Named[];
  goods: Named[];
}

/** Loi dan dat, dat gioi han cua cau tra loi. */
function systemWords(): string {
  return [
    'Bạn là trợ lý tư vấn của PETMORY, xưởng làm sản phẩm len chọc thủ công theo ảnh thú cưng (tượng len, móc khóa, tranh len, hộp kỷ niệm), và bán kèm một số sản phẩm có sẵn cho thú cưng.',
    'Giọng thân thiện, ấm áp, xưng "mình" và gọi khách là "bạn". Trả lời bằng ngôn ngữ khách dùng; mặc định tiếng Việt có dấu.',
    'Chỉ dùng giá, kích cỡ, thời gian, chính sách và sản phẩm có trong KHO TRI THỨC và DANH MỤC được cung cấp. Tuyệt đối không tự nghĩ ra con số, sản phẩm, chương trình khuyến mãi hay chính sách khác.',
    'Không chắc hoặc không có trong dữ liệu thì nói thật là mình chưa có thông tin, và mời khách bấm "Gặp tư vấn viên".',
    'Khi phù hợp, gợi ý đúng tên và mã sản phẩm có trong danh mục, và gợi ý khách vào Studio 3D để tự phối màu cho bé.',
    'Gợi ý chuyển sang tư vấn viên khi khách muốn gặp người, khiếu nại, hỏi về một đơn hàng cụ thể, hoặc hỏi về hoàn tiền, đổi trả.',
    'Với câu hỏi sức khỏe thú cưng, chỉ trả lời rất chung và khuyên đưa bé tới bác sĩ thú y.',
    'Nếu khách nhắc tới thú cưng đã mất, hãy chia buồn nhẹ nhàng trước khi tư vấn.',
    'Không bao giờ hỏi, nhắc lại hay lưu mật khẩu, mã OTP, số thẻ, số tài khoản; không hỏi địa chỉ hay số điện thoại của khách.',
    'Chỉ chào ở lượt trả lời đầu tiên của cuộc trò chuyện; các lượt sau đi thẳng vào nội dung, không mở đầu bằng "Chào bạn".',
    'Gọi sản phẩm bằng tên đầy đủ đúng như trong danh mục; không ghi mã sản phẩm (dạng PT-01, G-...) trong câu trả lời.',
    'Trả lời ngắn gọn, dưới 150 chữ, có thể xuống dòng hoặc gạch đầu dòng cho dễ đọc. Không dùng định dạng markdown như dấu sao hay dấu thăng.',
  ].join(' ');
}

/** Cac luot gan nhat, viet lai cho dich vu doc. */
function recallWords(one: ChatSessionDocument): string {
  return one.turn
    .slice(-TURN_RECALL)
    .map((each) => `${each.side === ChatSide.USER ? 'Khách' : 'Tư vấn'}: ${each.text}`)
    .join('\n');
}

/**
 * Cac ma san pham that su duoc nhac toi trong cau tra loi.
 *
 * Doi chieu lai voi danh muc that chu khong tin cau tra loi, de man hinh
 * khong bao gio dung the cho mot mon hang khong ton tai.
 */
/**
 * Chon the san pham kem cau tra loi khi khong co AI (muc 18): san pham va hang
 * co san duoc nhac toi trong loi noi, cong san pham dang noi toi trong phien.
 * Toi da ba the moi loai cho gon.
 */
export function cardsFor(
  said: string,
  focusCode: string,
  shop: { kinds: Named[]; goods: Named[] },
): { productCode: string[]; goodsCode: string[] } {
  const productCode = pickCodes(said, shop.kinds);
  if (focusCode && !productCode.includes(focusCode)) {
    productCode.unshift(focusCode);
  }
  return { productCode: productCode.slice(0, 3), goodsCode: pickCodes(said, shop.goods).slice(0, 3) };
}

function pickCodes(text: string, known: Named[]): string[] {
  const upper = text.toUpperCase();
  const low = text.toLowerCase();
  return known
    .filter((one) => upper.includes(one.code.toUpperCase()) || low.includes(one.name.toLowerCase()))
    .map((one) => one.code);
}

/** So tien viet cho nguoi doc. */
function asDong(raw: string): string {
  const whole = raw.split('.')[0] || '0';
  return `${new Intl.NumberFormat('vi-VN').format(BigInt(whole))} VND`;
}
