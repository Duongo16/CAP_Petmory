import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PetPhoto, PetPhotoSchema } from '../photos/schemas/pet-photo.schema';
import { Pet, PetSchema } from '../pets/schemas/pet.schema';
import { AdminService } from './admin.service';
import { ProductionFileService } from './production-file.service';
import { AdminController } from './admin.controller';
import { OrdersModule } from '../orders/orders.module';
import { PetsModule } from '../pets/pets.module';
import { DesignsModule } from '../designs/designs.module';
import { CatalogModule } from '../catalog/catalog.module';
import { MemoriesModule } from '../memories/memories.module';
import { BusinessConfigModule } from '../business-config/business-config.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: PetPhoto.name, schema: PetPhotoSchema },
      { name: Pet.name, schema: PetSchema },
    ]),
    OrdersModule,
    PetsModule,
    DesignsModule,
    CatalogModule,
    MemoriesModule,
    BusinessConfigModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, ProductionFileService],
})
export class AdminModule {}
