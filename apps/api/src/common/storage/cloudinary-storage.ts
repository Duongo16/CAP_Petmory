import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import {
  PUBLIC_FOLDER,
  StorageFolder,
  StorageFolderName,
  StorageService,
} from './storage.service';
import { MSG } from '../constants/messages';

/** The folder each group lands in on the picture service. */
const REMOTE_FOLDER: Record<StorageFolderName, string> = {
  [StorageFolder.PET]: 'petmory/pets',
  [StorageFolder.DESIGN]: 'petmory/designs',
  [StorageFolder.COMMUNITY]: 'petmory/community',
};

/**
 * How a group is delivered.
 *
 * Community pictures sit on a public post, so a plain address is right and the
 * content network can cache it. Pet pictures and design previews belong to one
 * customer and the API answers with not found when anyone else asks, so a plain
 * address would hand that protection away. Those are stored as authenticated
 * and only ever given out as a signed address that stops working shortly after.
 */
function deliveryOf(folder: StorageFolderName): 'upload' | 'authenticated' {
  return PUBLIC_FOLDER.has(folder) ? 'upload' : 'authenticated';
}

/** The part of the name after the last dot, which the service stores apart. */
function formatOf(fileName: string): string {
  const at = fileName.lastIndexOf('.');
  return at > 0 ? fileName.slice(at + 1) : 'png';
}

/** The name with that ending taken off. */
function withoutEnding(fileName: string): string {
  const at = fileName.lastIndexOf('.');
  return at > 0 ? fileName.slice(0, at) : fileName;
}

/** Keeps pictures on Cloudinary rather than on the disk of this machine. */
@Injectable()
export class CloudinaryStorage extends StorageService {
  private readonly log = new Logger(CloudinaryStorage.name);

  constructor(config: ConfigService) {
    super();
    cloudinary.config({
      cloud_name: config.getOrThrow<string>('storage.cloudinary.cloudName'),
      api_key: config.getOrThrow<string>('storage.cloudinary.apiKey'),
      api_secret: config.getOrThrow<string>('storage.cloudinary.apiSecret'),
      secure: true,
    });
  }

  get kind(): string {
    return 'cloudinary';
  }

  save(
    folder: StorageFolderName,
    fileName: string,
    data: Buffer,
    contentType: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          public_id: this.idOf(folder, fileName),
          format: formatOf(fileName),
          resource_type: 'image',
          type: deliveryOf(folder),
          overwrite: true,
          // The name is decided by the calling module, so nothing is derived
          // from what the browser sent and no suffix is added to keep it unique.
          use_filename: false,
          unique_filename: false,
        },
        (error) => {
          if (error) {
            this.log.error(`Upload failed for ${folder}: ${error.message}`);
            reject(new Error(error.message));
            return;
          }
          resolve();
        },
      );
      upload.end(data);
      void contentType;
    });
  }

  async read(folder: StorageFolderName, fileName: string): Promise<Buffer> {
    const address = this.addressOf(folder, fileName) ?? this.privateAddress(folder, fileName);
    const answer = await fetch(address);
    if (answer.status === 404) {
      /*
       * Ban ghi co nhung tep thi khong.
       * Day la chuyen khong tim thay chu khong phai may chu hong, nen phai tra
       * dung nhu vay. Truoc day no bao loi he thong, khien moi tam anh cu bi
       * coi la su co nghiem trong thay vi mot tep da mat.
       */
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    if (!answer.ok) {
      throw new Error(`Cannot read ${fileName}: ${answer.status}`);
    }
    return Buffer.from(await answer.arrayBuffer());
  }

  async remove(folder: StorageFolderName, fileName: string): Promise<void> {
    await cloudinary.uploader.destroy(this.idOf(folder, fileName), {
      resource_type: 'image',
      type: deliveryOf(folder),
      invalidate: true,
    });
  }

  /**
   * An address a browser may load, or nothing when there is none to give.
   *
   * Only community pictures get one. A pet picture belongs to one customer, and
   * on this plan the picture service does not enforce an expiry on a signed
   * address: it was measured, and an address built to have run out an hour ago
   * still returns the picture. Such an address is therefore a key that never
   * stops working, so handing one to a browser would give away the ownership
   * check for good. Those pictures keep going out through the API, which looks
   * at who is asking on every single request.
   */
  addressOf(folder: StorageFolderName, fileName: string): string | null {
    if (deliveryOf(folder) !== 'upload') {
      return null;
    }
    return cloudinary.url(this.idOf(folder, fileName), {
      type: 'upload',
      secure: true,
      format: formatOf(fileName),
      /*
       * Khong chen so phien ban gia vao dia chi.
       * Neu khong bao, thu vien tu them "v1" vao giua, va dia chi do luon tra
       * ve khong tim thay. Tep van nam nguyen tren dich vu, chi la dia chi sai.
       */
      force_version: false,
    });
  }

  /** The address the API itself uses to fetch bytes it will then hand on. */
  private privateAddress(folder: StorageFolderName, fileName: string): string {
    return cloudinary.url(this.idOf(folder, fileName), {
      type: deliveryOf(folder),
      sign_url: true,
      secure: true,
      format: formatOf(fileName),
      force_version: false,
    });
  }

  /**
   * The name a picture is filed under.
   *
   * The ending is left off on purpose. The picture service treats the ending as
   * a separate thing and adds it back when it builds an address, so leaving it
   * in the name would file the picture under a name ending twice over and every
   * read would come back empty.
   */
  private idOf(folder: StorageFolderName, fileName: string): string {
    return `${REMOTE_FOLDER[folder]}/${withoutEnding(fileName)}`;
  }
}
