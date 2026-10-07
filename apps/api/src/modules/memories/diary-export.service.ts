import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DiaryExport, DiaryExportDocument, ExportState } from './schemas/diary-export.schema';
import { Memory, MemoryDocument } from './schemas/memory.schema';
import { PetPhoto, PetPhotoDocument } from '../photos/schemas/pet-photo.schema';
import { PetDocument } from '../pets/schemas/pet.schema';
import { PetsService } from '../pets/pets.service';
import { PdfMaker } from './pdf-maker';
import { BusinessConfigService } from '../business-config/business-config.service';
import { StorageService, StorageFolder } from '../../common/storage/storage.service';
import { MSG } from '../../common/constants/messages';
import { runInBackground } from '../../common/background';

/**
 * Duong ve cua cac hinh trang tri.
 *
 * Chep dung bo hinh cua trinh duyet, vi tep in ra phai giong het nhung gi
 * nguoi dung nhin thay tren man hinh khi ho bay tri trang.
 */
const STICKER_PATH: Record<string, string> = {
  heart:
    'M50 86C20 66 8 50 8 34 8 20 19 10 32 10c8 0 14 4 18 10 4-6 10-10 18-10 13 0 24 10 24 24 0 16-12 32-42 52z',
  paw:
    'M50 52c14 0 26 11 26 22 0 8-6 14-14 14H38c-8 0-14-6-14-14 0-11 12-22 26-22zM26 22c6 0 10 6 10 13s-4 13-10 13-10-6-10-13 4-13 10-13zm48 0c6 0 10 6 10 13s-4 13-10 13-10-6-10-13 4-13 10-13zM50 8c6 0 10 6 10 14s-4 14-10 14-10-6-10-14 4-14 10-14z',
  star:
    'M50 8l12 26 28 4-20 20 5 28-25-13-25 13 5-28L10 38l28-4z',
  bone:
    'M24 34c-8 0-14 6-14 13s6 13 14 13c2 0 4 0 6-2h40c2 2 4 2 6 2 8 0 14-6 14-13s-6-13-14-13c-2 0-4 0-6 2H30c-2-2-4-2-6-2z',
  fish:
    'M14 50c12-18 32-26 48-26 8 0 14 2 18 6l-8 20 8 20c-4 4-10 6-18 6-16 0-36-8-48-26z',
  leaf:
    'M82 14C46 14 18 34 18 62c0 10 4 18 10 24 4-24 22-42 46-50-18 12-30 28-34 48 28-2 42-28 42-70z',
  cloud:
    'M28 70c-10 0-18-8-18-17s8-17 18-17c2-13 13-22 26-22 14 0 25 10 27 23 9 1 15 8 15 16 0 9-8 17-18 17z',
  sun:
    'M50 28c12 0 22 10 22 22S62 72 50 72 28 62 28 50s10-22 22-22zM46 4h8v14h-8zm0 78h8v14h-8zM4 46h14v8H4zm78 0h14v8H82zM16 21l6-6 10 10-6 6zm52 52l6-6 10 10-6 6zM26 73l-10 10 6 6 10-10zm52-52L68 31l6 6 10-10z',
  tape:
    'M6 34h88v32H6z',
  flower:
    'M50 42c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9zm0-32c8 0 14 7 14 15 0 4-2 8-4 10 4-2 8-3 12-3 8 0 15 6 15 14s-7 14-15 14c-4 0-8-1-12-3 2 2 4 6 4 10 0 8-6 15-14 15s-14-7-14-15c0-4 2-8 4-10-4 2-8 3-12 3-8 0-15-6-15-14s7-14 15-14c4 0 8 1 12 3-2-2-4-6-4-10 0-8 6-15 14-15z',
  ball:
    'M50 8c23 0 42 19 42 42S73 92 50 92 8 73 8 50 27 8 50 8zm0 10c-4 8-6 20-6 32s2 24 6 32c4-8 6-20 6-32s-2-24-6-32zM19 34c7 3 17 5 31 5s24-2 31-5c-3-6-8-11-14-13-5 6-11 10-17 10s-12-4-17-10c-6 2-11 7-14 13z',
  moon:
    'M62 8c-4 0-8 1-12 2 16 6 26 21 26 40s-10 34-26 40c4 1 8 2 12 2 23 0 42-19 42-42S85 8 62 8z',
};

/** Dia chi tai tep da xuat het han sau chung nay giay. */
const DOWNLOAD_SECONDS = 300;

/** Mot gio tinh bang phan nghin giay. */
const HOUR_MS = 3_600_000;

/** Nhieu nhat bao nhieu lan xuat con dang cho cho mot nguoi tai mot luc. */
const PENDING_LIMIT = 3;

/**
 * Xuat mot quyen nhat ky ra tep doc duoc.
 *
 * Viec nay chay nen: nguoi dung bam xuat, nhan ngay mot ma theo doi, roi hoi
 * lai xem xong chua. Lam vay vi mot quyen day anh co the mat vai chuc giay,
 * va giu nguoi dung cho truoc mot trang trang la cach doi xu te.
 *
 * Tep duoc giu tren chinh may chay may chu, khong gui sang dich vu anh, vi
 * day la thu tam thoi va se bi xoa khi het han.
 */
@Injectable()
export class DiaryExportService {
  private readonly logger = new Logger(DiaryExportService.name);

  constructor(
    @InjectModel(DiaryExport.name) private readonly model: Model<DiaryExportDocument>,
    @InjectModel(Memory.name) private readonly memoryModel: Model<MemoryDocument>,
    @InjectModel(PetPhoto.name) private readonly photoModel: Model<PetPhotoDocument>,
    private readonly pets: PetsService,
    private readonly maker: PdfMaker,
    private readonly config: BusinessConfigService,
    private readonly store: StorageService,
  ) {}

  /**
   * Nhan mot yeu cau xuat va bat dau lam ngay sau do.
   *
   * Ban ghi duoc tra ve truoc khi tep duoc dung xong, va phan dung tep chay
   * tiep o phia sau. Loi trong phan chay nen duoc ghi vao chinh ban ghi do,
   * khong bao gio bi nuot di.
   */
  async request(
    petId: string,
    owner: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<DiaryExportDocument> {
    const pet = await this.pets.findOwned(petId, owner);
    await this.sweepExpired();

    const waiting = await this.model
      .countDocuments({ owner: new Types.ObjectId(owner), state: ExportState.PENDING })
      .exec();
    if (waiting >= PENDING_LIMIT) {
      throw new BadRequestException('Dang co qua nhieu ban xuat cho san, vui long doi mot lat');
    }

    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;
    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException('Ngay bat dau phai truoc ngay ket thuc');
    }

    const keepHours = (await this.config.get()).exportKeepHours;
    const job = await this.model.create({
      owner: new Types.ObjectId(owner),
      pet: pet._id,
      state: ExportState.PENDING,
      fromDate: from,
      toDate: to,
      expiresAt: new Date(Date.now() + keepHours * HOUR_MS),
    });

    runInBackground(
      this.build(job, pet).catch((trouble: Error) => {
        this.logger.error(`Khong xuat duoc quyen nhat ky ${job.id}: ${trouble.message}`);
      }),
    );
    return job;
  }

  /** Trang thai mot lan xuat, chi chu so huu hoi duoc. */
  async statusOf(id: string, owner: string): Promise<DiaryExportDocument> {
    const job = await this.findOwned(id, owner);
    await this.expireIfDue(job);
    return job;
  }

  /**
   * Doc lai tep da xuat.
   *
   * Chi chu so huu tai duoc, ke ca khi quyen dang de cong khai, va tep het
   * han thi tra ve khong tim thay giong nhu chua tung co.
   */
  async fileOf(id: string, owner: string): Promise<{ bytes: Buffer | null; address: string | null; name: string }> {
    const job = await this.findOwned(id, owner);
    await this.expireIfDue(job);
    if (job.state !== ExportState.READY || !job.fileName) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    // Kho co dia chi tai co han dung thi dua dia chi do, tep lon khong phai di qua may chu.
    const address = this.store.temporaryAddress(StorageFolder.EXPORT, job.fileName, DOWNLOAD_SECONDS);
    if (address) {
      return { bytes: null, address, name: job.fileName };
    }
    const bytes = await this.store.read(StorageFolder.EXPORT, job.fileName).catch(() => null);
    if (!bytes) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return { bytes, address: null, name: job.fileName };
  }

  /** Cac lan xuat gan day cua mot quyen, de man hinh biet hien gi. */
  async listFor(petId: string, owner: string): Promise<DiaryExportDocument[]> {
    await this.pets.findOwned(petId, owner);
    await this.sweepExpired();
    return this.model
      .find({ pet: new Types.ObjectId(petId), owner: new Types.ObjectId(owner) })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();
  }

  private async findOwned(id: string, owner: string): Promise<DiaryExportDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const job = await this.model.findById(id).exec();
    if (!job || job.owner.toString() !== owner) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return job;
  }

  /** Mot ban xuat da qua han thi tep bi xoa va ban ghi doi trang thai. */
  private async expireIfDue(job: DiaryExportDocument): Promise<void> {
    if (job.state !== ExportState.READY || job.expiresAt.getTime() > Date.now()) {
      return;
    }
    await this.dropFile(job.fileName);
    job.state = ExportState.EXPIRED;
    job.fileName = '';
    await job.save();
  }

  /**
   * Don cac ban xuat da qua han.
   *
   * Chay kem moi lan co yeu cau xuat moi thay vi dat mot viec chay dinh ky,
   * vi mot viec chay dinh ky tren nhieu may can them khoa phan tan, ma o day
   * khong co gi phai chay neu khong ai xuat them.
   */
  private async sweepExpired(): Promise<void> {
    const due = await this.model
      .find({ state: ExportState.READY, expiresAt: { $lte: new Date() } })
      .limit(50)
      .exec();
    for (const job of due) {
      await this.expireIfDue(job);
    }
  }

  private async dropFile(fileName: string): Promise<void> {
    if (!fileName) {
      return;
    }
    await this.store.remove(StorageFolder.EXPORT, fileName).catch(() => undefined);
  }

  /** Dung tep that su. Chay ngoai duong tra loi cua may chu. */
  private async build(job: DiaryExportDocument, pet: PetDocument): Promise<void> {
    try {
      const moments = await this.momentsOf(job);
      const html = await this.pageOf(pet, moments);
      const bytes = await this.maker.fromHtml(html);
      const fileName = `nhat-ky-${job.id}.pdf`;
      await this.store.save(StorageFolder.EXPORT, fileName, bytes, 'application/pdf');

      job.state = ExportState.READY;
      job.fileName = fileName;
      job.byteSize = bytes.length;
      job.momentCount = moments.length;
      await job.save();
    } catch (trouble) {
      job.state = ExportState.FAILED;
      job.problem = 'Khong dung duoc tep. Vui long thu lai sau.';
      await job.save();
      throw trouble instanceof Error ? trouble : new Error(String(trouble));
    }
  }

  /** Cac khoanh khac nam trong khoang thoi gian da chon, cu truoc moi sau. */
  private momentsOf(job: DiaryExportDocument): Promise<MemoryDocument[]> {
    const where: Record<string, unknown> = { pet: job.pet, isHidden: false };
    const window: Record<string, Date> = {};
    if (job.fromDate) {
      window.$gte = job.fromDate;
    }
    if (job.toDate) {
      window.$lte = job.toDate;
    }
    if (Object.keys(window).length > 0) {
      where.happenedAt = window;
    }
    return this.memoryModel.find(where).sort({ happenedAt: 1 }).exec();
  }

  /**
   * Trang in cua ca quyen.
   *
   * Anh duoc nhung thang vao trang o dung do phan giai da luu, khong dung ban
   * thu nho, vi tep nay con de in ra giay.
   */
  private async pageOf(pet: PetDocument, moments: MemoryDocument[]): Promise<string> {
    const photoIds = [
      ...moments.flatMap((one) => one.photo),
      ...moments.flatMap((one) => one.decor.map((item) => item.photo)),
    ].filter((one): one is Types.ObjectId => Boolean(one));
    const photos = await this.photoModel
      .find({ _id: { $in: photoIds }, isHidden: false })
      .exec();
    const bytesOf = new Map<string, string>();
    for (const photo of photos) {
      const data = await this.store
        .read(StorageFolder.PET, photo.fileName)
        .catch(() => null);
      if (data) {
        bytesOf.set(photo._id.toString(), asDataUri(photo.fileType, data));
      }
    }

    const blocks = moments
      .map((one) => this.blockOf(one, bytesOf))
      .join('');
    return diaryPage(safe(pet.name), safe(pet.tagline), blocks, moments.length);
  }

  /**
   * Mot khoanh khac tren trang in.
   *
   * Trang da duoc chu bay tri thi in ra dung nhu tren man hinh: tung mon nam
   * dung cho cu, vi vi tri von da ghi theo phan tram cua trang. Trang chua
   * bay tri thi in theo loi mac dinh.
   */
  private blockOf(one: MemoryDocument, bytesOf: Map<string, string>): string {
    if (one.decor.length > 0) {
      return this.decoratedOf(one, bytesOf);
    }
    const pictures = one.photo
      .map((id) => bytesOf.get(id.toString()))
      .filter((src): src is string => Boolean(src))
      .map((src) => `<img class="shot" src="${src}" alt="" />`)
      .join('');
    const place = one.place ? `<span class="place">${safe(one.place)}</span>` : '';
    const body = one.body ? `<p class="body">${safe(one.body)}</p>` : '';
    return (
      '<article class="moment">' +
      `<header><h2>${safe(one.title)}</h2>` +
      `<p class="when">${asDay(one.happenedAt)}${place}</p></header>` +
      body +
      (pictures ? `<div class="shots">${pictures}</div>` : '') +
      '</article>'
    );
  }

  /** Mot trang da duoc chu bay tri, in ra dung nhu no bay tren man hinh. */
  private decoratedOf(one: MemoryDocument, bytesOf: Map<string, string>): string {
    const layers = [...one.decor]
      .sort((a, b) => a.z - b.z)
      .map((item) => this.layerOf(item, bytesOf))
      .join('');
    const paper = String(one.paper || 'CREAM').toLowerCase();
    return (
      `<article class="moment sheet paper-${paper}">` +
      `<p class="folio">${asDay(one.happenedAt)} · ${safe(one.title)}</p>` +
      `<div class="canvas">${layers}</div>` +
      '</article>'
    );
  }

  /** Mot mon do tren trang da bay tri. */
  private layerOf(item: MemoryDocument['decor'][number], bytesOf: Map<string, string>): string {
    const place =
      `left:${item.x}%;top:${item.y}%;width:${item.width}%;` +
      `transform:rotate(${item.rotate}deg);z-index:${item.z};`;
    if (item.kind === 'TEXT') {
      const tint = item.color ? `color:${safe(item.color)};` : '';
      const face = String(item.fontKey || 'HAND').toLowerCase();
      return `<div class="item font-${face}" style="${place}${tint}">${safe(item.text)}</div>`;
    }
    if (item.kind === 'PHOTO') {
      const src = item.photo ? bytesOf.get(item.photo.toString()) : null;
      return src ? `<div class="item" style="${place}"><img class="pin" src="${src}" alt="" /></div>` : '';
    }
    const path = STICKER_PATH[item.sticker] ?? '';
    if (!path) {
      return '';
    }
    const fill = safe(item.color || '#b0413e');
    return (
      `<div class="item" style="${place}">` +
      `<svg viewBox="0 0 100 100"><path d="${path}" fill="${fill}" /></svg>` +
      '</div>'
    );
  }
}

/** Doi mot tep anh thanh dia chi nhung thang vao trang. */
function asDataUri(fileType: string, data: Buffer): string {
  const kind = fileType === 'jpg' ? 'jpeg' : fileType;
  return `data:image/${kind};base64,${data.toString('base64')}`;
}

/** Ngay thang viet theo loi doc cua nguoi Viet. */
function asDay(when: Date): string {
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(when.getDate())}/${two(when.getMonth() + 1)}/${when.getFullYear()}`;
}

/** Bo tac dung cua cac ky tu danh dau trong chu nguoi dung go vao. */
function safe(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Khung trang in, giu rieng de phan dung noi dung o tren doc gon. */
function diaryPage(name: string, tagline: string, blocks: string, count: number): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,700;1,400&display=block" />
<style>
  @page { size: A4; }
  body { font-family: "Noto Sans", "Segoe UI", sans-serif; color: #231a13; margin: 0; }
  h1 { font-size: 30px; margin: 0 0 4px; }
  .tagline { color: #7c757f; margin: 0 0 6px; font-style: italic; }
  .count { color: #7c757f; margin: 0 0 24px; font-size: 13px; }
  .moment { page-break-inside: avoid; margin-bottom: 26px; border-top: 1px solid #efe3da; padding-top: 14px; }
  /* Trang da bay tri: mot to giay rieng, moi mon nam dung cho chu da dat. */
  .sheet { position: relative; aspect-ratio: 4 / 5; border-top: none; padding: 16px; overflow: hidden; border-radius: 6px; }
  .sheet .canvas { position: absolute; inset: 16px; }
  .sheet .item { position: absolute; transform-origin: center; }
  .sheet .item img.pin { display: block; width: 100%; padding: 4px 4px 12px; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
  .sheet .item svg { display: block; width: 100%; height: auto; }
  .sheet .folio { position: absolute; right: 16px; bottom: 8px; margin: 0; font-size: 11px; opacity: 0.5; }
  .font-hand { font-size: 19px; line-height: 1.5; white-space: pre-wrap; }
  .font-body { font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
  .font-serif { font-size: 16px; line-height: 1.5; white-space: pre-wrap; }
  .paper-cream { background: #fbf3e4; }
  .paper-kraft { background: #e6d3b3; }
  .paper-dot { background-color: #fbf3e4; background-image: radial-gradient(rgba(120,96,66,0.22) 1.2px, transparent 1.2px); background-size: 18px 18px; }
  .paper-line { background-color: #fbf3e4; background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(120,96,66,0.22) 27px, rgba(120,96,66,0.22) 28px); }
  .paper-grid { background-color: #fbf3e4; background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 21px, rgba(120,96,66,0.22) 21px, rgba(120,96,66,0.22) 22px), repeating-linear-gradient(to right, transparent 0, transparent 21px, rgba(120,96,66,0.22) 21px, rgba(120,96,66,0.22) 22px); }
  .paper-bloom { background-color: #fdeef0; background-image: radial-gradient(circle at 18% 22%, rgba(214,150,165,0.35) 0 7px, transparent 8px), radial-gradient(circle at 74% 38%, rgba(214,150,165,0.35) 0 5px, transparent 6px), radial-gradient(circle at 42% 78%, rgba(214,150,165,0.35) 0 6px, transparent 7px); background-size: 120px 120px; }
  .moment h2 { font-size: 18px; margin: 0 0 3px; }
  .when { color: #7c757f; font-size: 12px; margin: 0 0 8px; }
  .place { margin-left: 10px; }
  .body { font-size: 14px; line-height: 1.7; white-space: pre-wrap; margin: 0 0 10px; }
  .shots { display: flex; flex-wrap: wrap; gap: 8px; }
  .shot { max-width: 250px; max-height: 250px; border-radius: 8px; }
</style></head><body>
<h1>${name}</h1>
<p class="tagline">${tagline}</p>
<p class="count">${count} khoanh khac</p>
${blocks}
</body></html>`;
}
