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

  /** Mo mot phien moi. Khach chua dang nhap cung mo duoc. */
  async open(owner: string | null): Promise<ChatSessionDocument> {
    return this.model.create({
      code: `${randomUUID()}${randomUUID().replace(/-/g, '')}`,
      owner: owner ? new Types.ObjectId(owner) : null,
      state: ChatState.BOT,
      turn: [
        {
          side: ChatSide.BOT,
          text: HELLO,
          suggestion: this.basic.getInitialSuggestions(),
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
   * Ma phien la chia khoa, nen ai co ma thi doc duoc. Voi phien co chu, kiem
   * them chu so huu: mot nguoi dang nhap khong duoc doc phien cua tai khoan
   * khac ngay ca khi ho co ma.
   */
  async findFor(code: string, owner: string | null): Promise<ChatSessionDocument> {
    const one = await this.model.findOne({ code }).exec();
    if (!one) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    if (one.owner && one.owner.toString() !== owner) {
      throw new ForbiddenException(MSG.NOT_FOUND);
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
    const basic = await this.basic.ask(question);
    return {
      text: basic.content,
      suggestion: basic.suggestion,
      path: basic.path ?? '',
      productCode: [],
      goodsCode: [],
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

    const shop = await this.shopWords();
    const answer = await this.client.ask({
      system: systemWords(),
      prompt: [
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
    return {
      text: answer.text.trim(),
      suggestion: this.basic.getInitialSuggestions(),
      path: '',
      productCode: pickCodes(answer.text, shop.kindCode),
      goodsCode: pickCodes(answer.text, shop.goodsCode),
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
      kindCode: kind.map((one) => one.code),
      goodsCode: ready.rows.map((one) => one.code),
    };
  }
}

/** Danh muc that, kem cac ma de doi chieu lai cau tra loi. */
interface ShopWords {
  text: string;
  kindCode: string[];
  goodsCode: string[];
}

/** Loi dan dat, dat gioi han cua cau tra loi. */
function systemWords(): string {
  return [
    'Bạn là tư vấn viên của PETMORY, một xưởng làm thú nhồi bông thủ công từ len tái chế theo ảnh thú cưng.',
    'Chỉ nói về những sản phẩm có trong danh mục được cung cấp. Không được nghĩ ra sản phẩm, giá hay thời gian nào khác.',
    'Không biết thì nói không biết và mời khách gặp tư vấn viên.',
    'Trả lời bằng tiếng Việt, ngắn gọn, không quá 150 chữ.',
    'Không hỏi và không nhắc lại số điện thoại, địa chỉ hay bất kỳ thông tin riêng nào của khách.',
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
function pickCodes(text: string, known: string[]): string[] {
  const upper = text.toUpperCase();
  return known.filter((code) => upper.includes(code.toUpperCase()));
}

/** So tien viet cho nguoi doc. */
function asDong(raw: string): string {
  const whole = raw.split('.')[0] || '0';
  return `${new Intl.NumberFormat('vi-VN').format(BigInt(whole))} VND`;
}
