import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      // ValidationPipe (class-validator) mengirim { message: string[], error, statusCode }
      // Exception kustom kita mengirim { message: string, errors }
      let message = 'Terjadi kesalahan.';
      let errors: unknown = null;

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        if (Array.isArray(b.message)) {
          message = 'Validasi gagal.';
          errors = b.message;
        } else if (typeof b.message === 'string') {
          message = b.message;
        }
        if ('errors' in b) {
          errors = b.errors;
        }
      }

      res
        .status(status)
        .json({ success: false, code: status, message, errors });
      return;
    }

    // Error tak terduga -> jangan bocorkan detail internal ke client.
    this.logger.error(exception instanceof Error ? exception.stack : exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      code: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Terjadi kesalahan pada server.',
      errors: null,
    });
  }
}
