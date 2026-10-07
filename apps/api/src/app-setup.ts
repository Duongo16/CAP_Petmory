import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { HEADER_RESEMBLANCE, HEADER_MODE, HEADER_SKIPPED } from './modules/photos/photo-restore.controller';

/**
 * Cau hinh chung cua ung dung.
 *
 * May chu chay thuong va ban chay tren nen tang theo tung yeu cau deu goi
 * ham nay, de hai noi luon co cung tien to duong dan, cung chinh sach nguon
 * goc va cung cach kiem du lieu vao.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.getOrThrow<string>('webOrigin'),
    credentials: true,
    exposedHeaders: [HEADER_RESEMBLANCE, HEADER_MODE, HEADER_SKIPPED],
  });

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
}
