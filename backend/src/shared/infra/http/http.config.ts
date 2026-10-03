import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Pipeline HTTP comum à aplicação e aos testes de controller. */
export function configureHttp<T extends INestApplication>(app: T): T {
  // whitelist sem forbidNonWhitelisted: campos extras da plataforma são ignorados, não rejeitados.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  return app;
}
