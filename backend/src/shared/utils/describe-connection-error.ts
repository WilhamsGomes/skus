const HINTS: Record<string, string> = {
  ECONNREFUSED: 'conexão recusada: o serviço está rodando? (npm run infra:up)',
  ENOTFOUND: 'host não encontrado: confira a URL no .env',
  ETIMEDOUT: 'tempo de conexão esgotado: host inacessível ou firewall',
  ECONNRESET: 'conexão encerrada pelo servidor',
  '28P01': 'usuário ou senha inválidos',
  '3D000': 'banco de dados não existe',
};


export function describeConnectionError(error: unknown): string {
  if (typeof error !== 'object' || error === null) return String(error);

  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  if (code) return HINTS[code] ? `${HINTS[code]} [${code}]` : code;

  const message = error instanceof Error ? error.message.trim() : '';
  return message || error.constructor.name;
}
