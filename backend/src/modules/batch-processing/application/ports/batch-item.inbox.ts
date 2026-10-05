import type { ReceivedItem } from '../../domain/received-item';

/** Entrada durável das mensagens de /process. Classe abstrata para servir de token de injeção. */
export abstract class BatchItemInbox {
  /**
   * Grava o item se `(runId, seq)` ainda não existe, numa única operação atômica:
   * duas entregas simultâneas da mesma mensagem nunca criam dois itens.
   * @returns `true` se gravou, `false` se era duplicata.
   */
  abstract recordIfNew(item: ReceivedItem): Promise<boolean>;
}
