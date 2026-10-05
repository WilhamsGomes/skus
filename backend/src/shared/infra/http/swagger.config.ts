import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';
export const SWAGGER_JSON_PATH = 'docs-json';

export function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('SKU Enrichment Integration')
    .setDescription(
      'Recebe lotes de SKUs, enriquece de forma assíncrona e devolve o resultado consolidado.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.security = [{ bearer: [] }];
  SwaggerModule.setup(SWAGGER_PATH, app, document, { jsonDocumentUrl: SWAGGER_JSON_PATH });
}
