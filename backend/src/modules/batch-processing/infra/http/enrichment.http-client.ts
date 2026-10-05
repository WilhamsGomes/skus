import { Inject, Injectable } from "@nestjs/common";
import {
  APP_CONFIG,
  type AppConfig,
} from "../../../../shared/config/app-config";
import type { PlatformCredentials } from "../../../registration/domain/registration";
import {
  EnrichmentResult,
  InvalidEnrichmentResultError,
} from "../../domain/enrichment-result";
import {
  EnrichmentRateLimitedError,
  EnrichmentUnauthorizedError,
  EnrichmentUnavailableError,
  SkuNotFoundError,
} from "../../application/enrichment.errors";
import type { EnrichmentClient } from "../../application/ports/enrichment.client";

const ENRICH_TIMEOUT_MS = 5_000;
export const DEFAULT_RETRY_AFTER_MS = 1_000;

@Injectable()
export class EnrichmentHttpClient implements EnrichmentClient {
  private readonly baseUrl: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.baseUrl = config.platformBaseUrl;
  }

  async enrich(
    sku: string,
    { cid, token }: PlatformCredentials,
  ): Promise<EnrichmentResult> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/enrich/${encodeURIComponent(sku)}`,
        {
          headers: { "x-cid": cid, "x-token": token },
          signal: AbortSignal.timeout(ENRICH_TIMEOUT_MS),
        },
      );
    } catch (error) {
      throw new EnrichmentUnavailableError(
        "GET /enrich failed before a response",
        { cause: error },
      );
    }

    switch (response.status) {
      case 200:
        return parseResult(await response.json().catch(() => null));
      case 429:
        throw new EnrichmentRateLimitedError(
          parseRetryAfter(response.headers.get("retry-after")),
        );
      case 404:
        throw new SkuNotFoundError(sku);
      case 401:
        throw new EnrichmentUnauthorizedError();
      default:
        throw new EnrichmentUnavailableError(
          `GET /enrich responded ${response.status}`,
        );
    }
  }
}

function parseResult(body: unknown): EnrichmentResult {
  const { price, stock } = (body ?? {}) as Record<string, unknown>;
  try {
    return EnrichmentResult.from({ price, stock });
  } catch (error) {
    if (error instanceof InvalidEnrichmentResultError) {
      throw new EnrichmentUnavailableError(
        `GET /enrich response out of contract: ${error.message}`,
      );
    }
    throw error;
  }
}

export function parseRetryAfter(header: string | null): number {
  if (!header) return DEFAULT_RETRY_AFTER_MS;

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);

  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(date - Date.now(), 0);

  return DEFAULT_RETRY_AFTER_MS;
}
