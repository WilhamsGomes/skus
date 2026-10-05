import { Injectable } from "@nestjs/common";
import { RegistrationRepository } from "../../registration/application/ports/registration.repository";
import { RunNotFoundError } from "./callback.errors";
import { RunCredentialsNotFoundError } from "./enrichment.errors";
import { BatchItemStore } from "./ports/batch-item.store";
import { BatchPlatformClient } from "./ports/batch-platform.client";
import { BatchRunStore } from "./ports/batch-run.store";

export interface SendBatchCallbackOutput {
  readonly items: number;
  readonly report: unknown;
}

@Injectable()
export class SendBatchCallbackUseCase {
  constructor(
    private readonly runs: BatchRunStore,
    private readonly registrations: RegistrationRepository,
    private readonly items: BatchItemStore,
    private readonly platform: BatchPlatformClient,
  ) {}

  async execute(runId: string): Promise<SendBatchCallbackOutput> {
    const run = await this.runs.find(runId);
    if (!run) throw new RunNotFoundError(runId);

    const credentials = await this.registrations.findByCid(run.cid);
    if (!credentials) throw new RunCredentialsNotFoundError(run.cid);

    const result = await this.items.listForCallback(runId);
    const report = await this.platform.sendResult(credentials, runId, result);
    await this.runs.markCallbackSent(runId, report);

    return { items: result.length, report };
  }
}
