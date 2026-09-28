import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BusinessConfig, BusinessConfigSchema } from './schemas/business-config.schema';
import { BusinessConfigService } from './business-config.service';
import { BusinessConfigController } from './business-config.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BusinessConfig.name, schema: BusinessConfigSchema }]),
  ],
  controllers: [BusinessConfigController],
  providers: [BusinessConfigService],
  exports: [BusinessConfigService],
})
export class BusinessConfigModule {}
