import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { PetPhoto, PetPhotoSchema } from './schemas/pet-photo.schema';
import { PhotosService } from './photos.service';
import { PhotosController } from './photos.controller';
import { PhotoRestoreController } from './photo-restore.controller';
import { PhotoRestoreService } from './photo-restore.service';
import { PetsModule } from '../pets/pets.module';
import { BusinessConfigModule } from '../business-config/business-config.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PetPhoto.name, schema: PetPhotoSchema }]),
        // Keep the file in memory so the real format can be checked before writing to disk.
    MulterModule.register({ limits: { fileSize: 25 * 1024 * 1024 } }),
    PetsModule,
    BusinessConfigModule,
  ],
  controllers: [PhotosController, PhotoRestoreController],
  providers: [PhotosService, PhotoRestoreService],
  exports: [PhotosService],
})
export class PhotosModule {}
