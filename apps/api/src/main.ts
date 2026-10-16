import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { configureApp } from './app-setup';
import { useWorkingDns } from './config/dns';

async function bootstrap(): Promise<void> {
  useWorkingDns();
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  // Vercel dat cong qua bien moi truong PORT; chay tren may thi dung cong trong cau hinh.
  const port = Number(process.env.PORT ?? app.get(ConfigService).getOrThrow<number>('port'));
  await app.listen(port);
  Logger.log(`API dang chay tai http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
