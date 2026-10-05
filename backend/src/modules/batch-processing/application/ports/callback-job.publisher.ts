import type { RepublishOutcome } from "./enrichment-job.publisher";

export abstract class CallbackJobPublisher {
  abstract publish(runId: string): Promise<void>;
  abstract republish(runId: string): Promise<RepublishOutcome>;
}
