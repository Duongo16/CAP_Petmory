/**
 * Where uploaded pictures live.
 *
 * Every module that keeps a picture goes through this instead of touching the
 * disk, so the place the bytes end up can be swapped without any module knowing.
 * One setting in the environment decides which of the two stores is used.
 */

/**
 * The three logical groups of pictures. They are kept apart because they are
 * not equally public: only the community group may be read by anyone with the
 * address, while the other two belong to one customer and stay behind a check.
 */
export const StorageFolder = {
  PET: 'pets',
  DESIGN: 'designs',
  COMMUNITY: 'community',
  /** Tep nhat ky da xuat, chi chu so huu tai duoc va tu het han. */
  EXPORT: 'exports',
} as const;

export type StorageFolderName = (typeof StorageFolder)[keyof typeof StorageFolder];

/** The groups anyone may read. Everything else needs the owner check first. */
export const PUBLIC_FOLDER: ReadonlySet<string> = new Set([StorageFolder.COMMUNITY]);

export abstract class StorageService {
  /** Keeps the bytes. The name is decided by the calling module, not here. */
  abstract save(
    folder: StorageFolderName,
    fileName: string,
    data: Buffer,
    contentType: string,
  ): Promise<void>;

  /** Reads the bytes back. Throws when the name is not there. */
  abstract read(folder: StorageFolderName, fileName: string): Promise<Buffer>;

  /** Removes the bytes. Missing files are not an error, so this can be retried. */
  abstract remove(folder: StorageFolderName, fileName: string): Promise<void>;

  /**
   * An address a browser can load the picture from, or null when this store has
   * no such address and the bytes must be served by the API itself.
   *
   * For a group that is not public the address is signed and expires, so it
   * cannot be passed around after the owner check that produced it.
   */
  abstract addressOf(folder: StorageFolderName, fileName: string): string | null;

  /**
   * Dia chi tai tep co han dung that, hoac rong khi kho nay khong cap duoc.
   *
   * Khac voi dia chi o tren, dia chi nay het han dung sau so giay cho truoc,
   * nen chi duoc cap sau khi da kiem chu so huu, va dung cho tep qua lon de
   * may chu tu tra truc tiep.
   */
  abstract temporaryAddress(folder: StorageFolderName, fileName: string, seconds: number): string | null;

  /** A short word naming the store, used by the startup log and the checks. */
  abstract get kind(): string;
}
