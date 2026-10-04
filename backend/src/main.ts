import "reflect-metadata";
import { existsSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { APP_CONFIG, type AppConfig } from "./shared/config/app-config";
import { configureHttp } from "./shared/infra/http/http.config";
import { configureSwagger } from "./shared/infra/http/swagger.config";
import { HttpLoggingInterceptor } from "./shared/interceptors/http-logging.interceptor";

async function bootstrap(): Promise<void> {
  if (existsSync(".env")) process.loadEnvFile(".env");

  const app = configureHttp(await NestFactory.create(AppModule));
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.enableShutdownHooks();
  configureSwagger(app);

  const { port } = app.get<AppConfig>(APP_CONFIG);
  await app.listen(port);
}

void bootstrap();
