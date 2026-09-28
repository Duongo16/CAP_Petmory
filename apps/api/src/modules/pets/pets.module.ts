import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Pet, PetSchema } from './schemas/pet.schema';
import { PetsService } from './pets.service';
import { PetsController } from './pets.controller';
import { UsersModule } from '../users/users.module';
import { BusinessConfigModule } from '../business-config/business-config.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Pet.name, schema: PetSchema }]),
    UsersModule,
    BusinessConfigModule,
  ],
  controllers: [PetsController],
  providers: [PetsService],
  exports: [PetsService],
})
export class PetsModule {}
