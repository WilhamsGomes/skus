import type { PlatformCredentials } from '../../../registration/domain/registration';
import type { CallbackItem } from './batch-item.store';

/** Resposta do POST /burst: a plataforma começa a enviar as mensagens para /process logo em seguida. */
export interface BurstTicket {
  readonly runId: string;
  /** Quantidade de itens do lote. Vem da plataforma; nunca assumir 20 fixo. */
  readonly total: number;
  readonly startedAt: Date;
}

/** Saída para os endpoints de lote da plataforma. Classe abstrata para servir de token de injeção. */
export abstract class BatchPlatformClient {
  /** @throws PlatformUnavailableError em erro de rede, timeout, status não 2xx ou resposta fora do contrato. */
  abstract requestBurst(credentials: PlatformCredentials): Promise<BurstTicket>;
  abstract sendResult(
    credentials: PlatformCredentials,
    runId: string,
    result: CallbackItem[],
  ): Promise<unknown>;
}
