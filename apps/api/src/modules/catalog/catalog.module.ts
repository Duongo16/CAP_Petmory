import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ColorCode, ColorCodeSchema } from './schemas/color-code.schema';
import { ProductType, ProductTypeSchema } from './schemas/product-type.schema';
import { DisplayBase, DisplayBaseSchema } from './schemas/display-base.schema';
import { Accessory, AccessorySchema } from './schemas/accessory.schema';
import { PackagingOption, PackagingOptionSchema } from './schemas/packaging-option.schema';
import { CatalogAdminService } from './catalog-admin.service';
import { CatalogAdminController } from './catalog-admin.controller';
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
      { name: Accessory.name, schema: AccessorySchema },
      { name: PackagingOption.name, schema: PackagingOptionSchema },
    ]),
  ],
  controllers: [CatalogController, CatalogAdminController],
  providers: [CatalogService, CatalogAdminService],
  exports: [CatalogService],
})
export class CatalogModule {}
