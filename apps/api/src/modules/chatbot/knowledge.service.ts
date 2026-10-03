import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AssistantKnowledge,
  AssistantKnowledgeDocument,
  KnowledgeTopic,
} from './schemas/assistant-knowledge.schema';
import { KnowledgeDto, UpdateKnowledgeDto } from './dto/knowledge.dto';
import { MSG } from '../../common/constants/messages';

/** Ma co so du lieu tra ve khi mot chi muc duy nhat da co nguoi chiem. */
const DUPLICATE_KEY = 11000;

/** Giu danh sach muc dang bat trong bo nho bao lau, tinh bang mili giay. */
const CACHE_MS = 30_000;

/** Bo dau tieng Viet de so tu khoa khong phu thuoc cach go. */
export function plain(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Kho tri thuc cua tro ly.
 *
 * Tro ly doc danh sach muc dang bat rat thuong xuyen, nen danh sach do duoc
 * giu trong bo nho mot luc va duoc doc lai ngay khi co ai sua kho.
 */
@Injectable()
export class KnowledgeService {
  private cache: { at: number; rows: AssistantKnowledgeDocument[] } | null = null;

  constructor(
    @InjectModel(AssistantKnowledge.name) private readonly model: Model<AssistantKnowledgeDocument>,
  ) {}

  /** Cac muc dang bat, xep theo thu tu nhom Quan ly da dat. */
  async active(): Promise<AssistantKnowledgeDocument[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) {
      return this.cache.rows;
    }
    const rows = await this.model
      .find({ isHidden: false, enabled: true })
      .sort({ sortOrder: 1, code: 1 })
      .exec();
    this.cache = { at: Date.now(), rows };
    return rows;
  }

  /** Danh sach cho trang quan tri, loc theo chu de va tu khoa. */
  list(topic?: KnowledgeTopic, keyword?: string): Promise<AssistantKnowledgeDocument[]> {
    const where: Record<string, unknown> = { isHidden: false };
    if (topic) {
      where['topic'] = topic;
    }
    const word = keyword?.trim();
    if (word) {
      const like = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      where['$or'] = [{ question: like }, { answer: like }, { code: like }, { keywords: like }];
    }
    return this.model.find(where).sort({ sortOrder: 1, code: 1 }).exec();
  }

  async create(dto: KnowledgeDto): Promise<AssistantKnowledgeDocument> {
    try {
      const made = await this.model.create({
        ...dto,
        code: dto.code.toUpperCase(),
        keywords: cleanWords(dto.keywords),
        followUp: (dto.followUp ?? []).map((one) => one.toUpperCase()),
      });
      this.cache = null;
      return made;
    } catch (trouble) {
      if ((trouble as { code?: number } | null)?.code === DUPLICATE_KEY) {
        throw new ConflictException('Ma muc hoi dap nay da co roi');
      }
      throw trouble;
    }
  }

  async update(code: string, dto: UpdateKnowledgeDto): Promise<AssistantKnowledgeDocument> {
    const change: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(dto)) {
      if (value !== undefined) {
        change[name] = value;
      }
    }
    if (dto.keywords) {
      change['keywords'] = cleanWords(dto.keywords);
    }
    if (dto.followUp) {
      change['followUp'] = dto.followUp.map((one) => one.toUpperCase());
    }
    const saved = await this.model
      .findOneAndUpdate({ code: code.toUpperCase(), isHidden: false }, { $set: change }, { new: true, runValidators: true })
      .exec();
    if (!saved) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    this.cache = null;
    return saved;
  }

  async hide(code: string): Promise<AssistantKnowledgeDocument> {
    const saved = await this.model
      .findOneAndUpdate(
        { code: code.toUpperCase(), isHidden: false },
        { $set: { isHidden: true, enabled: false } },
        { new: true },
      )
      .exec();
    if (!saved) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    this.cache = null;
    return saved;
  }
}

/** Tu khoa duoc bo dau va bo trung truoc khi luu, de so nhanh va dung. */
function cleanWords(words: string[]): string[] {
  return [...new Set(words.map(plain).filter((one) => one.length > 0))];
}
