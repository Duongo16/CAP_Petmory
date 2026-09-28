import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.getOrThrow<string>('webOrigin'), credentials: true });

  /**
   * Reject bad input at the boundary. Only fields declared on the DTO are
   * accepted, so nothing can be assigned into a record by accident.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const port = config.getOrThrow<number>('port');
  await app.listen(port);
  Logger.log(`API dang chay tai http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
