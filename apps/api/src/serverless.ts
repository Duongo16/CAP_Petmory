import express, { Express, Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app-setup';

/**
 * Diem vao cua API khi chay tren Vercel.
 *
 * Moi lan khoi dong lanh, ung dung duoc dung mot lan roi giu lai cho cac yeu
 * cau sau tren cung tien trinh, de khong phai noi lai co so du lieu moi lan.
 * Yeu cau den van mang nguyen duong dan bat dau bang tien to api, nen dinh
 * tuyen giong het may chu chay thuong.
 */
let ready: Promise<Express> | null = null;

async function boot(): Promise<Express> {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), { bufferLogs: false });
  configureApp(app);
  await app.init();
  return server;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  ready ??= boot().catch((trouble: unknown) => {
    // Khoi dong hong thi lan sau thu lai tu dau, khong giu mai mot loi.
    ready = null;
    throw trouble;
  });
  const server = await ready;
  server(req, res);
}
