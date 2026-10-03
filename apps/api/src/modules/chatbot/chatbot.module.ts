import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatSession, ChatSessionSchema } from './schemas/chat-session.schema';
import { AssistantKnowledge, AssistantKnowledgeSchema } from './schemas/assistant-knowledge.schema';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeAdminController } from './knowledge-admin.controller';
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
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: AssistantKnowledge.name, schema: AssistantKnowledgeSchema },
    ]),
    CatalogModule,
    GoodsModule,
    BusinessConfigModule,
  ],
  controllers: [ChatbotController, ChatSessionController, ChatStaffController, KnowledgeAdminController],
  providers: [ChatbotService, ChatSessionService, KnowledgeService],
})
export class ChatbotModule {}
