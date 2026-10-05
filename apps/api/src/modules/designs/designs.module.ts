import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Design, DesignSchema } from './schemas/design.schema';
import {
  DesignSuggestion,
  DesignSuggestionSchema,
} from './schemas/design-suggestion.schema';
import { DesignsService } from './designs.service';
import { Cart, CartSchema } from '../cart/schemas/cart.schema';
import { DesignSuggestService } from './design-suggest.service';
import { ModelLibraryService } from './model-library.service';
import { DesignsController } from './designs.controller';
import { DesignSuggestController } from './design-suggest.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { PetsModule } from '../pets/pets.module';
import { PhotosModule } from '../photos/photos.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Design.name, schema: DesignSchema },
      { name: DesignSuggestion.name, schema: DesignSuggestionSchema },
      // Chi de kiem ban thiet ke con nam trong gio truoc khi cho xoa.
      { name: Cart.name, schema: CartSchema },
    ]),
    CatalogModule,
    PetsModule,
    PhotosModule,
  ],
  controllers: [DesignsController, DesignSuggestController],
  providers: [DesignsService, DesignSuggestService, ModelLibraryService],
  exports: [DesignsService, ModelLibraryService],
})
export class DesignsModule {}
