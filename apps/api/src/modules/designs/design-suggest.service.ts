import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  DesignSuggestion,
  DesignSuggestionDocument,
  MAX_OPTION,
  SuggestOption,
  SuggestStyle,
} from './schemas/design-suggestion.schema';
import { Design, DesignDocument } from './schemas/design.schema';
import { BaseModel, ModelLibraryService } from './model-library.service';
import { AiClientService } from '../ai/ai-client.service';
import { AiQuotaService } from '../ai/ai-quota.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { AiKind, AiMode } from '../ai/schemas/ai-usage.schema';
import { CatalogService } from '../catalog/catalog.service';
import { ColorGroup } from '../catalog/schemas/color-code.schema';
import { PetsService } from '../pets/pets.service';
import { PhotosService } from '../photos/photos.service';
import { MSG } from '../../common/constants/messages';

/** Toi da bao nhieu buc anh gui kem khi xin goi y. */
const PHOTO_MAX = 3;

/** Anh lon hon muc nay thi bo qua, de mot lan goi khong keo qua lau. */
const PHOTO_BYTES_MAX = 4 * 1024 * 1024;

/** Mo ta tung phong cach, viet ra de loi dan khong phu thuoc ten khoa. */
const STYLE_NOTE: Record<SuggestStyle, string> = {
  [SuggestStyle.TRUE_TO_LIFE]: 'bám sát màu lông thật của bé trong ảnh',
  [SuggestStyle.SOFT]: 'màu dịu và nhã nhặn, hợp làm quà tưởng nhớ',
  [SuggestStyle.VIVID]: 'màu tươi và tương phản rõ, nhìn vui mắt',
  [SuggestStyle.PASTEL]: 'màu phấn nhạt, kiểu tranh vẽ cho trẻ nhỏ',
};

/** Ten hai vung mat va mui, dung bang mau rieng chu khong dung mau long. */
const FACE_ZONE = ['EYE', 'NOSE'];

/**
 * Goi y thiet ke tu anh thu cung.
 *
 * Chuc nang nay khong dung mo hinh ba chieu moi. No chi lam hai viec: chon
 * mau nen hop nhat trong thu vien co san, va chon ma mau len cho tung vung co
 * ten. Nguoi dung chon mot phuong an, he thong tao ban thiet ke tuong ung roi
 * mo sang buoc tuy bien de chinh tiep.
 *
 * Khi chua co khoa dich vu, hoac khi goi dich vu that khong duoc, phan goi y
 * van chay bang mot bo phuong an dung san sinh tu chinh ho so cua be va bang
 * mau that. Ket qua kem hon nhung luong van di het, va tung lan deu duoc ghi
 * ro la lan that hay lan mau.
 */
@Injectable()
export class DesignSuggestService {
  private readonly logger = new Logger(DesignSuggestService.name);

  constructor(
    @InjectModel(DesignSuggestion.name)
    private readonly model: Model<DesignSuggestionDocument>,
    @InjectModel(Design.name) private readonly design: Model<DesignDocument>,
    private readonly library: ModelLibraryService,
    private readonly client: AiClientService,
    private readonly quota: AiQuotaService,
    private readonly usage: AiUsageService,
    private readonly catalog: CatalogService,
    private readonly pets: PetsService,
    private readonly photos: PhotosService,
  ) {}

  /** Cac phong cach chon duoc, kem loi mo ta cho man hinh. */
  styles(): { key: SuggestStyle; note: string }[] {
    return Object.values(SuggestStyle).map((key) => ({ key, note: STYLE_NOTE[key] }));
  }

  listMine(owner: string) {
    return this.model
      .find({ owner: new Types.ObjectId(owner) })
      .sort({ createdAt: -1 })
      .limit(30)
      .exec();
  }

  /** Doc mot lan goi y, va chi cho dung chu cua no doc. */
  async findOwned(code: string, owner: string): Promise<DesignSuggestionDocument> {
    const one = await this.model.findOne({ code }).exec();
    if (!one || one.owner.toString() !== owner) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return one;
  }

  /**
   * Xin mot bo phuong an thiet ke cho mot be.
   *
   * Suat han muc duoc chiem truoc khi goi dich vu, va duoc tra lai neu khong
   * sinh ra duoc phuong an nao, de mot lan hong khong an mat luot cua khach.
   */
  async ask(owner: string, petId: string, style: SuggestStyle): Promise<DesignSuggestionDocument> {
    const pet = await this.pets.findOwned(petId, owner);
    const base = this.library.ready();
    if (base.length === 0) {
      throw new BadRequestException('Thư viện mô hình đang trống, chưa gợi ý được');
    }

    const held = await this.quota.hold(owner, AiKind.DESIGN_SUGGESTION);
    try {
      const wool = await this.catalog.listColor(true, ColorGroup.FUR);
      const face = await this.catalog.listColor(true, ColorGroup.EYES_NOSE);
      const palette = [...wool, ...face].map((one) => ({
        code: one.code,
        name: one.displayName,
        group: one.group as string,
      }));

      const asked = await this.askService(owner, petId, pet, style, base, palette);
      const option = asked.option.length > 0 ? asked.option : samplePlan(pet, style, base, palette);
      const mode = asked.option.length > 0 ? asked.mode : AiMode.SAMPLE;

      const made = await this.model.create({
        owner: new Types.ObjectId(owner),
        pet: pet._id,
        code: randomUUID(),
        style,
        mode,
        option,
      });

      await this.usage.record(
        AiKind.DESIGN_SUGGESTION,
        owner,
        mode,
        made._id.toString(),
        asked.problem,
      );
      return made;
    } catch (trouble) {
      await this.quota.release(held);
      throw trouble;
    }
  }

  /**
   * Ap mot phuong an len mot ban thiet ke moi.
   *
   * Ban thiet ke sinh ra o day chua co mau to tung mat luoi, chi co mau tung
   * vung. Buoc tuy bien se doc mau vung ra roi pha len tung mat, de nguoi dung
   * chinh tiep dung nhu voi mot ban ho tu dung.
   */
  async choose(owner: string, code: string, optionKey: string): Promise<DesignDocument> {
    const one = await this.findOwned(code, owner);
    const picked = one.option.find((each) => each.key === optionKey);
    if (!picked) {
      throw new NotFoundException('Không có phương án nào mang mã này');
    }

    const made = await this.design.create({
      owner: new Types.ObjectId(owner),
      name: picked.title.slice(0, 80),
      modelCode: picked.modelCode,
      paint: [],
      zonePaint: picked.zonePaint,
      colorCodesUsed: [...new Set(picked.zonePaint.map((each) => each.colorCode))],
      pet: one.pet,
    });

    one.chosenKey = optionKey;
    one.appliedDesign = made._id;
    await one.save();
    return made;
  }

  /**
   * Hoi dich vu that.
   *
   * Tra ve danh sach rong khi chua co khoa, khi goi hong, hoac khi cau tra
   * loi khong dung khuon. Ben goi tu quyet dinh dung bo phuong an mau.
   */
  private async askService(
    owner: string,
    petId: string,
    pet: { name: string; kind: string; breed: string },
    style: SuggestStyle,
    base: BaseModel[],
    palette: { code: string; name: string; group: string }[],
  ): Promise<{ option: SuggestOption[]; mode: AiMode; problem: string }> {
    if (!this.client.live()) {
      return { option: [], mode: AiMode.SAMPLE, problem: 'Chua goi duoc dich vu that' };
    }

    const picture = await this.readPhotos(owner, petId);
    const zone = this.library.zoneName();
    const answer = await this.client.askShaped<{ option?: RawOption[] }>({
      system: systemWords(),
      prompt: askWords(pet, style, base, palette, zone),
      picture,
      maxWords: 3000,
    });

    if (!answer.value) {
      return { option: [], mode: AiMode.SAMPLE, problem: answer.problem };
    }
    const clean = this.cleanOptions(answer.value.option ?? [], palette, zone);
    return clean.length === 0
      ? { option: [], mode: AiMode.SAMPLE, problem: 'Phuong an tra ve khong dung thu vien' }
      : { option: clean, mode: AiMode.LIVE, problem: '' };
  }

  /**
   * Loc cac phuong an tra ve.
   *
   * Moi ma mau nen va moi ma mau len deu phai co that trong thu vien va trong
   * bang mau, neu khong thi bi bo. Khong bao gio tin thang mot ma do dich vu
   * ben ngoai tra ve, vi ma do se di thang vao ban thiet ke roi xuong xuong.
   */
  private cleanOptions(
    raw: RawOption[],
    palette: { code: string; name: string; group: string }[],
    zone: string[],
  ): SuggestOption[] {
    const codeOk = new Set(palette.map((one) => one.code.toUpperCase()));
    const zoneOk = new Set(zone);
    const out: SuggestOption[] = [];

    for (const one of raw.slice(0, MAX_OPTION)) {
      const model = this.library.byCode(String(one.modelCode ?? ''));
      if (!model) {
        continue;
      }
      const paint = (one.zonePaint ?? [])
        .map((each) => ({
          zone: String(each.zone ?? '').toUpperCase(),
          colorCode: String(each.colorCode ?? '').toUpperCase(),
        }))
        .filter((each) => zoneOk.has(each.zone) && codeOk.has(each.colorCode));
      if (paint.length === 0) {
        continue;
      }
      out.push({
        key: `P${out.length + 1}`,
        title: String(one.title ?? model.name).slice(0, 120),
        rationale: String(one.rationale ?? '').slice(0, 600),
        modelCode: model.code,
        zonePaint: paint,
      });
    }
    return out;
  }

  /**
   * Doc vai buc anh cua be de gui kem.
   *
   * Uu tien anh goc chua qua phuc hoi, vi day la thu gan nhat voi mau long
   * that. Anh qua nang thi bo qua.
   */
  private async readPhotos(owner: string, petId: string): Promise<{ data: string; kind: string }[]> {
    const out: { data: string; kind: string }[] = [];
    try {
      const all = await this.photos.listByPet(petId, owner);
      const pick = all.filter((one) => !one.isRestored).slice(0, PHOTO_MAX);
      for (const one of pick) {
        const read = await this.photos.readContent(one._id.toString(), owner);
        if (read.data.length <= PHOTO_BYTES_MAX) {
          out.push({ data: read.data.toString('base64'), kind: read.fileType });
        }
      }
    } catch (trouble) {
      const why = trouble instanceof Error ? trouble.message : String(trouble);
      this.logger.warn(`Khong doc duoc anh de gui kem: ${why}`);
    }
    return out;
  }
}

/** Khuon cac phuong an do dich vu tra ve, chua qua kiem tra. */
interface RawOption {
  title?: unknown;
  rationale?: unknown;
  modelCode?: unknown;
  zonePaint?: { zone?: unknown; colorCode?: unknown }[];
}

/** Loi dan dat, dat gioi han cua cau tra loi. */
function systemWords(): string {
  return [
    'Bạn là người tư vấn màu cho một xưởng làm thú nhồi bông thủ công từ len tái chế.',
    'Bạn chỉ được chọn trong danh sách mẫu nền và bảng mã màu được cung cấp.',
    'Không được nghĩ ra mã mới. Không được mô tả hình dáng mới.',
    'Trả lời bằng đúng một cấu trúc dữ liệu, không thêm lời dẫn nào khác.',
  ].join(' ');
}

/** Cau hoi that, kem thu vien mau nen va bang mau. */
function askWords(
  pet: { name: string; kind: string; breed: string },
  style: SuggestStyle,
  base: BaseModel[],
  palette: { code: string; name: string; group: string }[],
  zone: string[],
): string {
  const models = base.map((one) => `${one.code} (${one.name}, ${one.kind}, ${one.pose})`);
  const colours = palette.map((one) => `${one.code} (${one.name}, ${one.group})`);
  const shape =
    '{"option":[{"title":"","rationale":"","modelCode":"","zonePaint":[{"zone":"","colorCode":""}]}]}';

  return [
    `Bé tên ${pet.name}, loài ${pet.kind}, giống ${pet.breed || 'không rõ'}.`,
    `Phong cách khách chọn: ${STYLE_NOTE[style]}.`,
    'Hãy xem các bức ảnh gửi kèm rồi đề xuất tối đa 4 phương án khác nhau.',
    `Mẫu nền chọn được: ${models.join('; ')}.`,
    `Mã màu chọn được: ${colours.join('; ')}.`,
    `Các vùng phải tô màu: ${zone.join(', ')}.`,
    'Vùng mắt và mũi chỉ được dùng mã màu thuộc nhóm EYES_NOSE, các vùng còn lại dùng nhóm FUR.',
    'Mục rationale viết bằng tiếng Việt, không quá 2 câu, giải thích vì sao hợp với bé này.',
    `Trả về đúng khuôn sau: ${shape}`,
  ].join('\n');
}

/**
 * Bo phuong an dung san, dung khi khong goi duoc dich vu that.
 *
 * Khong phai tra loi vu vo: mau nen chon theo dung loai cua be, va ma mau lay
 * that tu bang mau dang bat. Bon phuong an lech nhau mot buoc tren bang mau
 * de nguoi dung co cai ma so sanh.
 */
function samplePlan(
  pet: { name: string; kind: string },
  style: SuggestStyle,
  base: BaseModel[],
  palette: { code: string; name: string; group: string }[],
): SuggestOption[] {
  const fur = palette.filter((one) => one.group === ColorGroup.FUR);
  const face = palette.filter((one) => one.group === ColorGroup.EYES_NOSE);
  if (fur.length === 0 || face.length === 0) {
    return [];
  }

  const fit = base.filter((one) => one.kind.toUpperCase() === pet.kind.toUpperCase());
  const usable = fit.length > 0 ? fit : base;
  const zone = ['MAIN_FUR', 'BELLY_FUR', 'EAR', 'TAIL'];
  const out: SuggestOption[] = [];

  for (let at = 0; at < MAX_OPTION && at < usable.length * 2; at += 1) {
    const model = usable[at % usable.length];
    const paint = zone.map((name, step) => ({
      zone: name,
      colorCode: fur[(at * 2 + step) % fur.length].code,
    }));
    for (const name of FACE_ZONE) {
      paint.push({ zone: name, colorCode: face[at % face.length].code });
    }
    out.push({
      key: `P${at + 1}`,
      title: `${model.name} — ${STYLE_NOTE[style]}`,
      rationale: `Phương án dựng sẵn cho ${pet.name}, ghép từ bảng màu len đang có. Bạn chỉnh lại từng vùng ở bước sau.`,
      modelCode: model.code,
      zonePaint: paint,
    });
  }
  return out;
}
