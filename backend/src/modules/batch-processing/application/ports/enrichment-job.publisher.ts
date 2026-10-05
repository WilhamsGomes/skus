import type { ReceivedItem } from "../../domain/received-item";

export type RepublishOutcome = "added" | "retried" | "already_queued";

export abstract class EnrichmentJobPublisher {
  abstract publish(item: ReceivedItem): Promise<void>;
  abstract republish(item: ReceivedItem): Promise<RepublishOutcome>;
}
