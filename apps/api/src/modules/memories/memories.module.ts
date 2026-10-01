import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Memory, MemorySchema } from './schemas/memory.schema';
import { DiaryShare, DiaryShareSchema } from './schemas/diary-share.schema';
import { DiaryExport, DiaryExportSchema } from './schemas/diary-export.schema';
import { PetStory, PetStorySchema } from './schemas/pet-story.schema';
import { MemoriesService } from './memories.service';
import { DiaryService } from './diary.service';
import { DiaryExportService } from './diary-export.service';
import { PetStoryService } from './pet-story.service';
import { BrowserPdfMaker, PdfMaker } from './pdf-maker';
import { MemoriesController } from './memories.controller';
import { PublicDiaryController } from './public-diary.controller';
import { PetStoryController } from './pet-story.controller';
import { PetsModule } from '../pets/pets.module';
import { Pet, PetSchema } from '../pets/schemas/pet.schema';
import { PetPhoto, PetPhotoSchema } from '../photos/schemas/pet-photo.schema';
import { BusinessConfigModule } from '../business-config/business-config.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Memory.name, schema: MemorySchema },
      { name: DiaryShare.name, schema: DiaryShareSchema },
      { name: DiaryExport.name, schema: DiaryExportSchema },
      { name: PetStory.name, schema: PetStorySchema },
      { name: Pet.name, schema: PetSchema },
      { name: PetPhoto.name, schema: PetPhotoSchema },
    ]),
    PetsModule,
    BusinessConfigModule,
  ],
  controllers: [MemoriesController, PublicDiaryController, PetStoryController],
  providers: [
    MemoriesService,
    DiaryService,
    DiaryExportService,
    PetStoryService,
    { provide: PdfMaker, useClass: BrowserPdfMaker },
  ],
  exports: [MemoriesService, DiaryService],
})
export class MemoriesModule {}
