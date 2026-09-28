import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ColorCode, ColorCodeSchema } from './schemas/color-code.schema';
import { ProductType, ProductTypeSchema } from './schemas/product-type.schema';
import { DisplayBase, DisplayBaseSchema } from './schemas/display-base.schema';
import { ProductReview, ProductReviewSchema } from '../reviews/schemas/product-review.schema';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ColorCode.name, schema: ColorCodeSchema },
      { name: ProductType.name, schema: ProductTypeSchema },
      { name: DisplayBase.name, schema: DisplayBaseSchema },
      { name: ProductReview.name, schema: ProductReviewSchema },
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
