import { Injectable, Logger } from '@nestjs/common';
import { ReceivedItem } from '../domain/received-item';
import { BatchItemInbox } from './ports/batch-item.inbox';

export interface ReceiveBatchItemInput {
  runId: string;
  seq: number;
  sku: string;
}

export interface ReceiveBatchItemOutput {
  /** A mensagem já tinha sido recebida; nada foi gravado. */
  readonly duplicate: boolean;
}

/**
 * Recebimento de uma mensagem do lote: só grava e retorna. Fica no caminho do ACK (SLA de 600 ms),
 * por isso não chama o enriquecimento nem espera nada além do insert.
 */
@Injectable()
export class ReceiveBatchItemUseCase {
  private readonly logger = new Logger(ReceiveBatchItemUseCase.name);

  constructor(private readonly inbox: BatchItemInbox) {}

  async execute(input: ReceiveBatchItemInput): Promise<ReceiveBatchItemOutput> {
    const item = ReceivedItem.from(input);
    const recorded = await this.inbox.recordIfNew(item);

    if (!recorded) this.logger.warn(`Duplicata ignorada: ${item.key}`);
    return { duplicate: !recorded };
  }
}
