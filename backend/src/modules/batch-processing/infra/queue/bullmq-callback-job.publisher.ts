import { Injectable } from "@nestjs/common";
import type { CallbackJobPublisher } from "../../application/ports/callback-job.publisher";
import { CallbackQueue } from "./callback.queue";

@Injectable()
export class BullMqCallbackJobPublisher implements CallbackJobPublisher {
  constructor(private readonly queue: CallbackQueue) {}

  async publish(runId: string): Promise<void> {
    await this.queue.add("send", { runId }, { jobId: runId });
  }
}
