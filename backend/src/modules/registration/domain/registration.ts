/**
 * Credenciais emitidas pela plataforma no POST /register.
 * `cid` + `token` autenticam todas as chamadas seguintes (burst, enrich, callback).
 */
export interface PlatformCredentials {
  readonly cid: string;
  readonly token: string;
}

/** Registro simples, sem comportamento: não justifica uma entidade. */
export interface Registration extends PlatformCredentials {
  readonly name: string;
  readonly webhook: string;
  readonly registeredAt: Date;
}
