import { Injectable, Logger } from "@nestjs/common";
import { ReceivedItem } from "../domain/received-item";
import { BatchItemInbox } from "./ports/batch-item.inbox";
import { EnrichmentJobPublisher } from "./ports/enrichment-job.publisher";

export interface ReceiveBatchItemInput {
  runId: string;
  seq: number;
  sku: string;
}

export interface ReceiveBatchItemOutput {
  /** A mensagem já tinha sido recebida; nada foi gravado. */
  readonly duplicate: boolean;
}

@Injectable()
export class ReceiveBatchItemUseCase {
  private readonly logger = new Logger(ReceiveBatchItemUseCase.name);

  constructor(
    private readonly inbox: BatchItemInbox,
    private readonly publisher: EnrichmentJobPublisher,
  ) {}

  async execute(input: ReceiveBatchItemInput): Promise<ReceiveBatchItemOutput> {
    const item = ReceivedItem.from(input);
    const recorded = await this.inbox.recordIfNew(item);

    if (!recorded) this.logger.warn(`Duplicata ignorada: ${item.key}`);

    await this.publish(item);
    return { duplicate: !recorded };
  }

  private async publish(item: ReceivedItem): Promise<void> {
    try {
      await this.publisher.publish(item);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha ao publicar ${item.key}: ${reason}`);
    }
  }
}
