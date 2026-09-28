import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PaymentNotification,
  PaymentNotificationSchema,
} from './schemas/payment-notification.schema';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { OrdersModule } from '../orders/orders.module';
import { BusinessConfigModule } from '../business-config/business-config.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentNotification.name, schema: PaymentNotificationSchema },
    ]),
    OrdersModule,
    BusinessConfigModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
