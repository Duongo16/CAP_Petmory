import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PetStory, PetStoryDocument, StoryHand, StoryTone } from './schemas/pet-story.schema';
import { Memory, MemoryDocument } from './schemas/memory.schema';
import { PetDocument } from '../pets/schemas/pet.schema';
import { PetsService } from '../pets/pets.service';
import { AiClientService } from '../ai/ai-client.service';
import { AiQuotaService } from '../ai/ai-quota.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { AiKind, AiMode } from '../ai/schemas/ai-usage.schema';
import { MSG } from '../../common/constants/messages';

/** Moi be giu nhieu nhat bay nhieu ban, de mot tai khoan khong phinh vo han. */
const STORY_MAX = 30;

/** Mo ta tung giong van, viet ra de loi dan khong phu thuoc ten khoa. */
const TONE_NOTE: Record<StoryTone, string> = {
  [StoryTone.WARM]: 'ấm áp và nhẹ nhàng, như kể cho một người bạn nghe',
  [StoryTone.PLAYFUL]: 'vui tươi và hóm hỉnh',
  [StoryTone.TENDER]: 'lắng đọng và trân trọng, dùng cho một bé đã đi xa',
  [StoryTone.SHORT]: 'ngắn gọn, vừa đủ một lời để tặng',
};

/**
 * Viet cau chuyen ve mot be.
 *
 * Nguon cua cau chuyen la ho so cua be cong voi cac y nguoi dung tu nhap.
 * Moi lan viet lai sinh mot ban moi, nen nguoi dung so sanh duoc cac ban va
 * khong bao gio mat ban cu.
 *
 * Khi chua co khoa dich vu, hoac khi goi dich vu that khong duoc, ban van
 * nhan duoc mot bai viet ghep tu chinh ho so cua be. Bai do khong hay bang,
 * nhung noi dung deu la that, va tung ban deu ghi ro la ban that hay ban mau.
 */
@Injectable()
export class PetStoryService {
  constructor(
    @InjectModel(PetStory.name) private readonly model: Model<PetStoryDocument>,
    @InjectModel(Memory.name) private readonly memory: Model<MemoryDocument>,
    private readonly pets: PetsService,
    private readonly client: AiClientService,
    private readonly quota: AiQuotaService,
    private readonly usage: AiUsageService,
  ) {}

  /** Cac giong van chon duoc, kem loi mo ta cho man hinh. */
  tones(): { key: StoryTone; note: string }[] {
    return Object.values(StoryTone).map((key) => ({ key, note: TONE_NOTE[key] }));
  }

  /** Cac ban cua mot be, ban moi nhat truoc. */
  async listByPet(petId: string, owner: string) {
    await this.pets.findOwned(petId, owner);
    return this.model
      .find({ pet: new Types.ObjectId(petId), isHidden: false })
      .sort({ createdAt: -1 })
      .exec();
  }

  /** Doc mot ban, va chi cho dung chu so huu doc. */
  async findOwned(id: string, owner: string): Promise<PetStoryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const one = await this.model.findOne({ _id: id, isHidden: false }).exec();
    if (!one || one.owner.toString() !== owner) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return one;
  }

  /**
   * Viet mot ban moi.
   *
   * Suat han muc duoc chiem truoc khi goi dich vu va tra lai khi viec that
   * bai, de mot lan hong khong an mat luot cua khach.
   */
  async write(owner: string, petId: string, tone: StoryTone, notes: string) {
    const pet = await this.pets.findOwned(petId, owner);
    const already = await this.model.countDocuments({
      pet: pet._id,
      isHidden: false,
    });
    if (already >= STORY_MAX) {
      throw new BadRequestException(`Mỗi bé chỉ lưu tối đa ${STORY_MAX} bản câu chuyện`);
    }

    const held = await this.quota.hold(owner, AiKind.STORY_WRITING);
    try {
      const written = await this.compose(pet, tone, notes);
      const made = await this.model.create({
        owner: new Types.ObjectId(owner),
        pet: pet._id,
        title: written.title,
        content: written.content,
        tone,
        notes,
        mode: written.mode,
        hand: StoryHand.MACHINE,
        version: already + 1,
      });

      await this.usage.record(
        AiKind.STORY_WRITING,
        owner,
        written.mode,
        made._id.toString(),
        written.problem,
      );
      return made;
    } catch (trouble) {
      await this.quota.release(held);
      throw trouble;
    }
  }

  /**
   * Viet lai tu mot ban da co.
   *
   * Ban cu khong bi dong vao. Lan viet lai tinh mot luot dung, vi cong viec
   * that su duoc lam mot lan nua.
   */
  async rewrite(owner: string, id: string, notes: string) {
    const older = await this.findOwned(id, owner);
    return this.write(owner, older.pet.toString(), older.tone, notes || older.notes);
  }

  /** Nguoi dung sua tay. Ban duoc danh dau la do nguoi viet chu khong phai may. */
  async edit(owner: string, id: string, title: string, content: string) {
    const one = await this.findOwned(id, owner);
    one.title = title;
    one.content = content;
    one.hand = StoryHand.PERSON;
    return one.save();
  }

  /**
   * Gan mot ban vao mot khoanh khac trong nhat ky.
   *
   * Ca hai phia deu phai thuoc ve nguoi dang goi, va phai cung mot be, neu
   * khong thi cau chuyen cua be nay se nam trong nhat ky cua be khac.
   */
  async attach(owner: string, id: string, memoryId: string) {
    const one = await this.findOwned(id, owner);
    if (!Types.ObjectId.isValid(memoryId)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const moment = await this.memory.findOne({ _id: memoryId, isHidden: false }).exec();
    if (!moment || moment.owner.toString() !== owner) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    if (moment.pet.toString() !== one.pet.toString()) {
      throw new BadRequestException('Câu chuyện và kỷ niệm không cùng một bé');
    }

    moment.body = one.content.slice(0, 4000);
    await moment.save();
    one.attachedMemory = moment._id;
    return one.save();
  }

  /** Bo mot ban. Ban cu van nam lai trong co so du lieu, chi khong hien ra nua. */
  async hide(owner: string, id: string) {
    const one = await this.findOwned(id, owner);
    one.isHidden = true;
    return one.save();
  }

  /** Goi dich vu that, hoac ghep mot bai tu ho so khi khong goi duoc. */
  private async compose(
    pet: PetDocument,
    tone: StoryTone,
    notes: string,
  ): Promise<{ title: string; content: string; mode: AiMode; problem: string }> {
    const answer = await this.client.ask({
      system: systemWords(),
      prompt: askWords(pet, tone, notes),
      maxWords: 2000,
    });

    if (answer.mode === AiMode.LIVE && answer.text.trim() !== '') {
      return {
        title: firstLine(answer.text, pet.name),
        content: answer.text.trim().slice(0, 6000),
        mode: AiMode.LIVE,
        problem: '',
      };
    }
    return {
      title: `Chuyện của ${pet.name}`,
      content: samplePlan(pet, tone, notes),
      mode: AiMode.SAMPLE,
      problem: answer.problem,
    };
  }
}

/** Loi dan dat, dat gioi han cua cau tra loi. */
function systemWords(): string {
  return [
    'Bạn giúp một người viết lại câu chuyện về thú cưng của họ.',
    'Chỉ dùng những chi tiết được cung cấp. Không được nghĩ thêm sự kiện, bệnh tật hay ngày tháng nào không có trong dữ liệu.',
    'Viết bằng tiếng Việt, văn xuôi, không dùng đầu dòng gạch đầu dòng.',
    'Không viết lời mở đầu kiểu đây là câu chuyện của bạn.',
  ].join(' ');
}

/** Cau hoi that, ghep tu ho so cua be va cac y nguoi dung nhap. */
function askWords(pet: PetDocument, tone: StoryTone, notes: string): string {
  const line: string[] = [`Tên bé: ${pet.name}.`, `Loài: ${pet.kind}.`];
  if (pet.breed) {
    line.push(`Giống: ${pet.breed}.`);
  }
  if (pet.birthDate) {
    line.push(`Ngày về nhà hoặc ngày sinh: ${asDay(pet.birthDate)}.`);
  }
  if (pet.status === 'PASSED_AWAY') {
    line.push(
      pet.passedAwayDate
        ? `Bé đã đi xa ngày ${asDay(pet.passedAwayDate)}. Hãy viết nhẹ nhàng và trân trọng.`
        : 'Bé đã đi xa. Hãy viết nhẹ nhàng và trân trọng.',
    );
  }
  if (pet.tagline) {
    line.push(`Một câu chủ đã viết về bé: ${pet.tagline}.`);
  }
  for (const each of pet.milestone.slice(0, 8)) {
    line.push(`Một mốc đáng nhớ: ${each.title} vào ${asDay(each.at)}. ${each.description}`.trim());
  }
  if (notes.trim() !== '') {
    line.push(`Các ý chủ muốn đưa vào: ${notes.trim()}`);
  }

  line.push(`Giọng văn mong muốn: ${TONE_NOTE[tone]}.`);
  line.push('Dòng đầu tiên là một tựa đề ngắn. Các dòng sau là câu chuyện, khoảng 200 đến 400 chữ.');
  return line.join('\n');
}

/**
 * Bai ghep san, dung khi khong goi duoc dich vu that.
 *
 * Khong bia mot chi tiet nao: tat ca deu lay tu ho so cua be va tu cac y
 * nguoi dung vua nhap.
 */
function samplePlan(pet: PetDocument, tone: StoryTone, notes: string): string {
  const part: string[] = [];
  part.push(`${pet.name} là một ${vietKind(pet.kind)}${pet.breed ? ` giống ${pet.breed}` : ''}.`);
  if (pet.tagline) {
    part.push(pet.tagline);
  }
  if (pet.birthDate) {
    part.push(`Câu chuyện bắt đầu từ ngày ${asDay(pet.birthDate)}.`);
  }

  const moc = pet.milestone.slice(0, 5);
  if (moc.length > 0) {
    part.push('Những mốc đáng nhớ:');
    for (const each of moc) {
      part.push(`Ngày ${asDay(each.at)}, ${each.title}. ${each.description}`.trim());
    }
  }
  if (notes.trim() !== '') {
    part.push(`Chủ còn muốn kể thêm: ${notes.trim()}`);
  }
  if (pet.status === 'PASSED_AWAY') {
    part.push(`${pet.name} không còn ở đây nữa, nhưng những ngày đó thì vẫn còn.`);
  }

  part.push('');
  part.push(
    `Bản này được ghép từ chính hồ sơ của bé, theo giọng văn ${TONE_NOTE[tone]}. Bạn sửa lại tùy ý, hoặc bấm viết lại để có một bản khác.`,
  );
  return part.join('\n');
}

/** Ten loai bang tieng Viet, de cau mo dau doc xuoi. */
function vietKind(kind: string): string {
  const name: Record<string, string> = {
    DOG: 'chú chó',
    CAT: 'cô mèo',
    RABBIT: 'chú thỏ',
    HAMSTER: 'chú chuột hamster',
    BIRD: 'chú chim',
  };
  return name[kind] ?? 'người bạn nhỏ';
}

/** Ngay thang viet cho nguoi doc, tinh theo gio quoc te nhu moi noi khac. */
function asDay(when: Date): string {
  const iso = new Date(when).toISOString().slice(0, 10).split('-');
  return `${iso[2]}/${iso[1]}/${iso[0]}`;
}

/** Dong dau tien lam tua de. Khong co dong nao dung duoc thi lay ten be. */
function firstLine(raw: string, fallback: string): string {
  const line = raw
    .split('\n')
    .map((one) => one.trim())
    .filter((one) => one !== '');
  const head = line[0] ?? '';
  return head === '' || head.length > 200 ? `Chuyện của ${fallback}` : head;
}
