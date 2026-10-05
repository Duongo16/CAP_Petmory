import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cart, CartSchema } from './schemas/cart.schema';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { DesignsModule } from '../designs/designs.module';
import { GoodsModule } from '../goods/goods.module';
import { PetPhoto, PetPhotoSchema } from '../photos/schemas/pet-photo.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: PetPhoto.name, schema: PetPhotoSchema },
    ]),
    CatalogModule,
    DesignsModule,
    GoodsModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
