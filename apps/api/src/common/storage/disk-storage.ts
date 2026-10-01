import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageFolder, StorageFolderName, StorageService } from './storage.service';

/**
 * Where each group sits under the upload directory.
 *
 * Pet pictures and design previews share the top of the directory because that
 * is where they were written before this class existed, and the names already
 * kept in the database have no folder in them. Changing that would orphan every
 * picture already on disk.
 */
const SUBDIRECTORY: Record<StorageFolderName, string> = {
  [StorageFolder.PET]: '',
  [StorageFolder.DESIGN]: '',
  [StorageFolder.COMMUNITY]: 'community',
};

/** Keeps pictures on the disk of the machine running the API. */
@Injectable()
export class DiskStorage extends StorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    super();
    this.root = path.resolve(config.getOrThrow<string>('upload.dir'));
  }

  get kind(): string {
    return 'disk';
  }

  async save(folder: StorageFolderName, fileName: string, data: Buffer): Promise<void> {
    const where = this.directoryOf(folder);
    await fs.mkdir(where, { recursive: true });
    await fs.writeFile(path.join(where, fileName), data);
  }

  read(folder: StorageFolderName, fileName: string): Promise<Buffer> {
    return fs.readFile(path.join(this.directoryOf(folder), fileName));
  }

  async remove(folder: StorageFolderName, fileName: string): Promise<void> {
    await fs.rm(path.join(this.directoryOf(folder), fileName), { force: true });
  }

  /** The disk has no address a browser can reach, so the API serves the bytes. */
  addressOf(): string | null {
    return null;
  }

  private directoryOf(folder: StorageFolderName): string {
    const sub = SUBDIRECTORY[folder];
    return sub ? path.join(this.root, sub) : this.root;
  }
}
