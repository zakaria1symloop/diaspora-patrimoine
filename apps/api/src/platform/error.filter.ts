// API-020 — maps every thrown value to the single error shape.
import { ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import { ErrorCode, type ApiErrorBody } from '@dp/contracts';
import type { Response } from 'express';
import { AppError } from './errors.js';
import { currentRequestId, log } from './request-context.js';

@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const error = this.toAppError(exception);
    if (error.status >= 500) {
      log('error', 'unhandled', {
        name: exception instanceof Error ? exception.name : typeof exception,
        message: exception instanceof Error ? exception.message.slice(0, 500) : undefined,
        stack: exception instanceof Error ? exception.stack?.split('\n').slice(0, 8).join(' | ') : undefined,
      });
    }
    for (const [k, v] of Object.entries(error.options.headers ?? {})) res.setHeader(k, v);
    const body: ApiErrorBody = {
      error: {
        code: error.code,
        reason: error.options.reason ?? null,
        params: error.options.params ?? null,
        details: error.options.details ?? [],
        requestId: currentRequestId(),
      },
    };
    res.status(error.status).json(body);
  }

  private toAppError(exception: unknown): AppError {
    if (exception instanceof AppError) return exception;
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status === 404) return new AppError(ErrorCode.NOT_FOUND);
      if (status === 413) return new AppError(ErrorCode.BAD_REQUEST);
      if (status >= 400 && status < 500) return new AppError(ErrorCode.BAD_REQUEST);
    }
    if (exception instanceof SyntaxError) return new AppError(ErrorCode.BAD_REQUEST);
    return new AppError(ErrorCode.INTERNAL_ERROR);
  }
}
