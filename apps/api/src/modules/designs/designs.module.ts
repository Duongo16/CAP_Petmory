import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Design, DesignSchema } from './schemas/design.schema';
import { DesignsService } from './designs.service';
import { DesignsController } from './designs.controller';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Design.name, schema: DesignSchema }]),
    CatalogModule,
  ],
  controllers: [DesignsController],
  providers: [DesignsService],
  exports: [DesignsService],
})
export class DesignsModule {}
