import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import { IsInt, IsString, IsUrl, Matches, Max, Min, MinLength, validateSync } from 'class-validator';

export const APP_CONFIG = Symbol('APP_CONFIG');

/** Configuração tipada consumida pelo restante da aplicação. Ninguém além deste arquivo lê variáveis de ambiente. */
export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly redisUrl: string;
  /** Base URL da plataforma (register, burst, enrich, callback), sem barra final. */
  readonly platformBaseUrl: string;
  readonly dashboardUsername: string;
  readonly dashboardPassword: string;
  readonly authSecret: string;
}

class EnvironmentVariables {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000;

  @IsString()
  @Matches(/^postgres(ql)?:\/\/.+/, { message: 'DATABASE_URL must be a postgresql:// URL' })
  DATABASE_URL!: string;

  @IsString()
  @Matches(/^rediss?:\/\/.+/, { message: 'REDIS_URL must be a redis:// or rediss:// URL' })
  REDIS_URL!: string;

  @IsUrl(
    { protocols: ['https', 'http'], require_protocol: true, require_tld: false },
    { message: 'PLATFORM_BASE_URL must be the platform Base URL from the challenge documentation' },
  )
  PLATFORM_BASE_URL!: string;

  @IsString()
  @MinLength(1)
  DASHBOARD_USERNAME = 'admin';

  @IsString()
  @MinLength(1)
  DASHBOARD_PASSWORD = 'admin';

  @IsString()
  @MinLength(16)
  AUTH_SECRET = 'dev-only-secret-change-me';
}

/** Valida o ambiente no startup; falha rápido com todas as violações de uma vez. */
export function loadAppConfig(env: Record<string, string | undefined>): AppConfig {
  const vars = plainToInstance(EnvironmentVariables, env);
  const errors = validateSync(vars, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    throw new Error(`Invalid environment configuration:\n- ${details.join('\n- ')}`);
  }

  return {
    port: vars.PORT,
    databaseUrl: vars.DATABASE_URL,
    redisUrl: vars.REDIS_URL,
    platformBaseUrl: vars.PLATFORM_BASE_URL.replace(/\/+$/, ''),
    dashboardUsername: vars.DASHBOARD_USERNAME,
    dashboardPassword: vars.DASHBOARD_PASSWORD,
    authSecret: vars.AUTH_SECRET,
  };
}
