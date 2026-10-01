import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudinaryStorage } from './cloudinary-storage';
import { DiskStorage } from './disk-storage';
import { RemoteImageService } from './remote-image';
import { StorageService } from './storage.service';

/**
 * Picks the picture store from the environment.
 *
 * Leaving the setting alone keeps everything on the disk, which is what the
 * automated checks run against so no test run costs anything or leaves stray
 * files behind on the picture service.
 */
@Global()
@Module({
  providers: [
    RemoteImageService,
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StorageService => {
        const wanted = config.get<string>('storage.driver') ?? 'disk';
        const store =
          wanted === 'cloudinary' ? new CloudinaryStorage(config) : new DiskStorage(config);
        new Logger('Storage').log(`Pictures are kept on: ${store.kind}`);
        return store;
      },
    },
  ],
  exports: [StorageService, RemoteImageService],
})
export class StorageModule {}
