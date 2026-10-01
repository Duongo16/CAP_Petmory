import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiUsage, AiUsageSchema } from './schemas/ai-usage.schema';
import { AiQuota, AiQuotaSchema } from './schemas/ai-quota.schema';
import { AiUsageService } from './ai-usage.service';
import { AiQuotaService } from './ai-quota.service';
import { AiClientService } from './ai-client.service';
import { BusinessConfigModule } from '../business-config/business-config.module';

/**
 * Nen chung cua cac chuc nang dung tri tue nhan tao.
 *
 * Gom ba phan: cho duy nhat goi ra dich vu ben ngoai, so dem han muc, va so
 * ghi cac luot da dung. Dat o pham vi toan he thong vi nhieu module khac nhau
 * deu dung: anh phuc hoi, goi y thiet ke, viet loi ke, tra loi hoi thoai. Bao
 * cao chi phi doc lai tu cung mot so nay.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiUsage.name, schema: AiUsageSchema },
      { name: AiQuota.name, schema: AiQuotaSchema },
    ]),
    BusinessConfigModule,
  ],
  providers: [AiUsageService, AiQuotaService, AiClientService],
  exports: [AiUsageService, AiQuotaService, AiClientService, MongooseModule],
})
export class AiModule {}
