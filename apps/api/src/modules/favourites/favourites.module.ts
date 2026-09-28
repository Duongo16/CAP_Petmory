import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Favourite, FavouriteSchema } from './schemas/favourite.schema';
import { FavouritesService } from './favourites.service';
import { FavouritesController } from './favourites.controller';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Favourite.name, schema: FavouriteSchema }]),
    CatalogModule,
  ],
  controllers: [FavouritesController],
  providers: [FavouritesService],
  exports: [FavouritesService],
})
export class FavouritesModule {}
