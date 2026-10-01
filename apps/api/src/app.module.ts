import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { StorageModule } from './common/storage/storage.module';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PetsModule } from './modules/pets/pets.module';
import { MemoriesModule } from './modules/memories/memories.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { BusinessConfigModule } from './modules/business-config/business-config.module';
import { CartModule } from './modules/cart/cart.module';
import { GoodsModule } from './modules/goods/goods.module';
import { AiModule } from './modules/ai/ai.module';
import { ReportsModule } from './modules/reports/reports.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PhotosModule } from './modules/photos/photos.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { DesignsModule } from './modules/designs/designs.module';
import { AdminModule } from './modules/admin/admin.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { FavouritesModule } from './modules/favourites/favourites.module';
import { CommunityModule } from './modules/community/community.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['../../.env', '.env'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('mongodbUri'),
        // Gioi han thoi gian cho, de mot su co duong truyen khong lam treo yeu cau.
        // Bat buoc khi co so du lieu nam tren mang chu khong nam cung may.
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 20,
        minPoolSize: 2,
        // Thu hoi ket noi de khong qua mot phut. Ben dich vu dam may cat am cac
        // ket noi nhan roi, neu giu lai thi yeu cau sau do se cho rat lau roi hong.
        maxIdleTimeMS: 60000,
        heartbeatFrequencyMS: 10000,
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    CommonModule,
    StorageModule,
    AuthModule,
    UsersModule,
    PetsModule,
    MemoriesModule,
    CatalogModule,
    BusinessConfigModule,
    AiModule,
    ReportsModule,
    GoodsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    PhotosModule,
    ChatbotModule,
    DesignsModule,
    AdminModule,
    ReviewsModule,
    FavouritesModule,
    CommunityModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
