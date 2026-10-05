import { Injectable } from "@nestjs/common";
import type { CallbackJobPublisher } from "../../application/ports/callback-job.publisher";
import type { RepublishOutcome } from "../../application/ports/enrichment-job.publisher";
import { CallbackQueue } from "./callback.queue";
import { ensureJob } from "./ensure-job";

@Injectable()
export class BullMqCallbackJobPublisher implements CallbackJobPublisher {
  constructor(private readonly queue: CallbackQueue) {}

  async publish(runId: string): Promise<void> {
    await this.queue.add("send", { runId }, { jobId: runId });
  }

  republish(runId: string): Promise<RepublishOutcome> {
    return ensureJob(this.queue, "send", { runId }, runId);
  }
}
