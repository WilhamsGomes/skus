import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 não carrega .env sozinho. Em ambientes sem arquivo, usa as variáveis do processo.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` não precisa de conexão; migrate falhará com mensagem clara se faltar.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
