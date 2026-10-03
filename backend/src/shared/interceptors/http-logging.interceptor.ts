import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/** Campos do payload que não podem aparecer em log (credenciais da plataforma). */
const SENSITIVE_FIELDS = ['token'];

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl, body } = request;
    const startedAt = Date.now();

    const hasBody = typeof body === 'object' && body !== null && Object.keys(body).length > 0;
    this.logger.log(`→ ${method} ${originalUrl}${hasBody ? ` | ${JSON.stringify(maskSensitive(body))}` : ''}`);

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(`← ${method} ${originalUrl} | ${response.statusCode} | ${Date.now() - startedAt}ms`);
        },
        error: (err: unknown) => {
          const status = typeof err === 'object' && err !== null && 'status' in err ? err.status : 500;
          this.logger.error(`← ${method} ${originalUrl} | ${status} | ${Date.now() - startedAt}ms`);
        },
      }),
    );
  }
}

function maskSensitive(body: Record<string, unknown>): Record<string, unknown> {
  const safe = { ...body };
  for (const field of SENSITIVE_FIELDS) if (field in safe) safe[field] = '***';
  return safe;
}
