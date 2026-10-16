import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * Normalises every error into one shape with a trace id.
 * Never leaks the technical detail of a server fault to the caller.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = randomUUID();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (clientErrorStatus(exception) ?? HttpStatus.INTERNAL_SERVER_ERROR);

    const message = this.readMessage(exception, status);
    const code = this.readCode(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${traceId} ${request.method} ${request.url}`, exception as Error);
    }

    response.status(status).json({
      success: false,
      traceId,
      status,
      message,
      // Ma loi nghiep vu (neu co) de giao dien noi dung cho can sua, khong phai doan chu.
      ...(code ? { code } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private readCode(exception: unknown): string | null {
    if (!(exception instanceof HttpException)) {
      return null;
    }
    const body = exception.getResponse();
    const code = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).code : null;
    return typeof code === 'string' && /^[A-Z_]{2,40}$/.test(code) ? code : null;
  }

  private readMessage(exception: unknown, status: number): string | string[] {
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return 'Da xay ra loi he thong. Vui long thu lai sau.';
    }
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        return body;
      }
      const detail = (body as Record<string, unknown>).message;
      return (detail as string | string[]) ?? exception.message;
    }
    if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
      return 'Du lieu gui len qua lon';
    }
    return 'Yeu cau khong hop le';
  }
}

/**
 * Ma loi 4xx cua cac loi HTTP ngoai Nest, nhu bo doc than yeu cau bao du lieu qua
 * lon (413) hoac JSON hong (400). Cac loi nay mang san truong status va duoc danh
 * dau expose; giu nguyen ma do thay vi quy thanh loi he thong 500.
 */
function clientErrorStatus(exception: unknown): number | null {
  if (typeof exception !== 'object' || exception === null) {
    return null;
  }
  const { status, expose } = exception as { status?: unknown; expose?: unknown };
  return typeof status === 'number' && status >= 400 && status < 500 && expose === true ? status : null;
}
