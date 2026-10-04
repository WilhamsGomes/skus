import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('SKU Enrichment Integration')
    .setDescription(
      'Recebe lotes de SKUs, enriquece de forma assíncrona e devolve o resultado consolidado.',
    )
    .setVersion('0.1.0')
    .build(); 

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });
}
