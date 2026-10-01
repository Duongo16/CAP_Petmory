import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './schemas/order.schema';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CartModule } from '../cart/cart.module';
import { GoodsModule } from '../goods/goods.module';
import { BusinessConfigModule } from '../business-config/business-config.module';
import { DesignsModule } from '../designs/designs.module';
import { PhotosModule } from '../photos/photos.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    CartModule,
    GoodsModule,
    BusinessConfigModule,
    DesignsModule,
    PhotosModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
