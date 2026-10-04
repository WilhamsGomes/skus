import {
  ArgumentsHost,
  BadGatewayException,
  Catch,
  ExceptionFilter,
  HttpException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  HandshakeFailedError,
  PlatformUnavailableError,
  RegistrationNotFoundError,
} from '../../application/registration.errors';

type RegistrationError = HandshakeFailedError | PlatformUnavailableError | RegistrationNotFoundError;

/** Traduz os erros da aplicação para HTTP, mantendo os controllers livres de try/catch. */
@Catch(HandshakeFailedError, PlatformUnavailableError, RegistrationNotFoundError)
export class RegistrationExceptionFilter implements ExceptionFilter<RegistrationError> {
  catch(error: RegistrationError, host: ArgumentsHost): void {
    const exception = toHttpException(error);
    host.switchToHttp().getResponse<Response>().status(exception.getStatus()).json(exception.getResponse());
  }
}

function toHttpException(error: RegistrationError): HttpException {
  if (error instanceof HandshakeFailedError) {
    // Mesmo formato do 422 da plataforma, para o operador ver o motivo original.
    return new UnprocessableEntityException({ error: 'handshake_failed', reason: error.reason });
  }
  if (error instanceof RegistrationNotFoundError) return new NotFoundException(error.message);
  return new BadGatewayException(error.message);
}
