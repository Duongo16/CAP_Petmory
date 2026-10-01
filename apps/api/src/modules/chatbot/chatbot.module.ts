import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatSession, ChatSessionSchema } from './schemas/chat-session.schema';
import { ChatbotService } from './chatbot.service';
import { ChatSessionService } from './chat-session.service';
import { ChatbotController } from './chatbot.controller';
import { ChatSessionController } from './chat-session.controller';
import { ChatStaffController } from './chat-staff.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { GoodsModule } from '../goods/goods.module';
import { BusinessConfigModule } from '../business-config/business-config.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ChatSession.name, schema: ChatSessionSchema }]),
    CatalogModule,
    GoodsModule,
    BusinessConfigModule,
  ],
  controllers: [ChatbotController, ChatSessionController, ChatStaffController],
  providers: [ChatbotService, ChatSessionService],
})
export class ChatbotModule {}
