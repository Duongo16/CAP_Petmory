import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { BusinessConfigModule } from '../business-config/business-config.module';

@Module({
  imports: [CatalogModule, BusinessConfigModule],
  controllers: [ChatbotController],
  providers: [ChatbotService],
})
export class ChatbotModule {}
