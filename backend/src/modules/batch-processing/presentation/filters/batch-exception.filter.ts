import {
  ArgumentsHost,
  BadGatewayException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  PlatformUnavailableError,
  RegistrationNotFoundError,
} from '../../../registration/application/registration.errors';

type BatchError = PlatformUnavailableError | RegistrationNotFoundError;

/** Traduz os erros da aplicação para HTTP, mantendo os controllers livres de try/catch. */
@Catch(PlatformUnavailableError, RegistrationNotFoundError)
export class BatchExceptionFilter implements ExceptionFilter<BatchError> {
  catch(error: BatchError, host: ArgumentsHost): void {
    const exception = toHttpException(error);
    host.switchToHttp().getResponse<Response>().status(exception.getStatus()).json(exception.getResponse());
  }
}

function toHttpException(error: BatchError): HttpException {
  // 409: a requisição é válida, mas o serviço precisa ser registrado antes (POST /registration).
  if (error instanceof RegistrationNotFoundError) return new ConflictException(error.message);
  return new BadGatewayException(error.message);
}
