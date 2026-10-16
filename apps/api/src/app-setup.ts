import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { HEADER_RESEMBLANCE, HEADER_MODE, HEADER_SKIPPED, HEADER_WARNING } from './modules/photos/photo-restore.controller';
import { COUNT_FACE_MAX, COUNT_MESH_MAX } from './modules/designs/dto/design.dto';

/**
 * Gioi han than yeu cau JSON.
 *
 * Ban thiet ke gui kem mau cua tung mat luoi (sau ky tu moi mat). Mac dinh cua
 * Express chi 100 KB, nen mau co nhieu mat (nhu cac mau chi dau) bi tu choi
 * truoc ca khi toi buoc kiem du lieu. Tinh thang tu gioi han DTO da cho phep,
 * cong them phan du cho cac truong khac, de hai gioi han luon khop nhau.
 */
const JSON_LIMIT_BYTES = COUNT_MESH_MAX * COUNT_FACE_MAX * 6 + 256 * 1024;

/**
 * Cau hinh chung cua ung dung.
 *
 * May chu chay thuong va ban chay tren nen tang theo tung yeu cau deu goi
 * ham nay, de hai noi luon co cung tien to duong dan, cung chinh sach nguon
 * goc va cung cach kiem du lieu vao.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  // Dang ky truoc khi ung dung khoi dong thi thay cho bo doc mac dinh 100 KB.
  const express = app as NestExpressApplication;
  express.useBodyParser('json', { limit: JSON_LIMIT_BYTES });
  express.useBodyParser('urlencoded', { limit: JSON_LIMIT_BYTES, extended: true });

  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.getOrThrow<string>('webOrigin'),
    credentials: true,
    exposedHeaders: [HEADER_RESEMBLANCE, HEADER_MODE, HEADER_SKIPPED, HEADER_WARNING],
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
