import "reflect-metadata";
import { existsSync } from "node:fs";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureQueueBoard, QUEUE_BOARD_PATH } from "./modules/batch-processing/infra/queue/queue-board";
import { APP_CONFIG, type AppConfig } from "./shared/config/app-config";
import { configureHttp } from "./shared/infra/http/http.config";
import { configureSwagger, SWAGGER_JSON_PATH, SWAGGER_PATH } from "./shared/infra/http/swagger.config";
import { HttpLoggingInterceptor } from "./shared/interceptors/http-logging.interceptor";
import { highlight } from "./shared/utils/highlight";

const logger = new Logger("Bootstrap");

async function bootstrap(): Promise<void> {
  if (existsSync(".env")) process.loadEnvFile(".env");

  const app = configureHttp(await NestFactory.create(AppModule));
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.enableShutdownHooks();
  configureSwagger(app);
  configureQueueBoard(app);

  const { port } = app.get<AppConfig>(APP_CONFIG);
  await app.listen(port);

  const baseUrl = `http://localhost:${port}`;
  logger.log(`API rodando em ${highlight(baseUrl)}`);
  logger.log(`Swagger em ${highlight(`${baseUrl}/${SWAGGER_PATH}`)}`);
  logger.log(`Swagger JSON em ${highlight(`${baseUrl}/${SWAGGER_JSON_PATH}`)}`);
  logger.log(`Painel da fila em ${highlight(`${baseUrl}/${QUEUE_BOARD_PATH}`)} (somente localhost)`);
}

bootstrap().catch((error: unknown) => {
  logger.error(`Falha ao iniciar a aplicação: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
