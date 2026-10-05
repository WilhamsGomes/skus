import { Injectable } from "@nestjs/common";
import type { ReceivedItem } from "../../domain/received-item";
import type {
  EnrichmentJobPublisher,
  RepublishOutcome,
} from "../../application/ports/enrichment-job.publisher";
import { ensureJob } from "./ensure-job";
import { EnrichmentQueue } from "./enrichment.queue";

export const PUBLISH_TIMEOUT_MS = 200;

@Injectable()
export class BullMqEnrichmentJobPublisher implements EnrichmentJobPublisher {
  constructor(private readonly queue: EnrichmentQueue) {}

  async publish(item: ReceivedItem): Promise<void> {
    const { runId, seq, sku } = item;
    const jobId = toJobId(item);
    await withTimeout(
      this.queue.add("enrich", { runId, seq, sku }, { jobId }),
      PUBLISH_TIMEOUT_MS,
      `publish ${jobId}`,
    );
  }

  republish(item: ReceivedItem): Promise<RepublishOutcome> {
    const { runId, seq, sku } = item;
    return ensureJob(this.queue, "enrich", { runId, seq, sku }, toJobId(item));
  }
}

export function toJobId(item: Pick<ReceivedItem, "runId" | "seq">): string {
  return `${item.runId}-${item.seq}`;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
