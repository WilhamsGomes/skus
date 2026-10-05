import type { PlatformCredentials } from "../../../registration/domain/registration";
import type { EnrichmentResult } from "../../domain/enrichment-result";

export abstract class EnrichmentClient {
  abstract enrich(sku: string, credentials: PlatformCredentials): Promise<EnrichmentResult>;
}
