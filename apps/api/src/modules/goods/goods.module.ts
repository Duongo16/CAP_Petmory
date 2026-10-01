import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Goods, GoodsSchema } from './schemas/goods.schema';
import { GoodsCategory, GoodsCategorySchema } from './schemas/goods-category.schema';
import { StockMove, StockMoveSchema } from './schemas/stock-move.schema';
import { GoodsService } from './goods.service';
import { GoodsAdminService } from './goods-admin.service';
import { GoodsController } from './goods.controller';
import { GoodsAdminController } from './goods-admin.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Goods.name, schema: GoodsSchema },
      { name: GoodsCategory.name, schema: GoodsCategorySchema },
      { name: StockMove.name, schema: StockMoveSchema },
    ]),
  ],
  controllers: [GoodsController, GoodsAdminController],
  providers: [GoodsService, GoodsAdminService],
  exports: [GoodsService],
})
export class GoodsModule {}
