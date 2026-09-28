import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PetPhoto, PetPhotoSchema } from '../photos/schemas/pet-photo.schema';
import { AdminService } from './admin.service';
import { ProductionFileService } from './production-file.service';
import { AdminController } from './admin.controller';
import { OrdersModule } from '../orders/orders.module';
import { PetsModule } from '../pets/pets.module';
import { DesignsModule } from '../designs/designs.module';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: PetPhoto.name, schema: PetPhotoSchema },
    ]),
    OrdersModule,
    PetsModule,
    DesignsModule,
    CatalogModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, ProductionFileService],
})
export class AdminModule {}
