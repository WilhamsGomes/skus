import type { ReceivedItem } from "../../domain/received-item";

export abstract class EnrichmentJobPublisher {
  abstract publish(item: ReceivedItem): Promise<void>;
}
