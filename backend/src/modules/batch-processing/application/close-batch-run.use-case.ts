import { Injectable, Logger } from "@nestjs/common";
import { BatchRunStore } from "./ports/batch-run.store";
import { CallbackJobPublisher } from "./ports/callback-job.publisher";

@Injectable()
export class CloseBatchRunUseCase {
  private readonly logger = new Logger(CloseBatchRunUseCase.name);

  constructor(
    private readonly runs: BatchRunStore,
    private readonly callbacks: CallbackJobPublisher,
  ) {}

  async execute(runId: string): Promise<boolean> {
    const claimed = await this.runs.claimCompletion(runId);
    if (!claimed) return false;

    this.logger.log(`Lote ${runId} completo, callback agendado`);
    await this.callbacks.publish(runId);
    return true;
  }
}
