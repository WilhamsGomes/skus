export class EnrichmentRateLimitedError extends Error {
  constructor(readonly retryAfterMs: number) {
    super(`GET /enrich rate limited, retry after ${retryAfterMs}ms`);
    this.name = "EnrichmentRateLimitedError";
  }
}

export class EnrichmentUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EnrichmentUnavailableError";
  }
}

export class SkuNotFoundError extends Error {
  constructor(readonly sku: string) {
    super(`SKU not found: ${sku}`);
    this.name = "SkuNotFoundError";
  }
}

export class EnrichmentUnauthorizedError extends Error {
  constructor() {
    super("GET /enrich rejected the credentials (401)");
    this.name = "EnrichmentUnauthorizedError";
  }
}

export class RunNotOpenError extends Error {
  constructor(readonly runId: string) {
    super(`Run ${runId} is not open yet`);
    this.name = "RunNotOpenError";
  }
}

export class RunCredentialsNotFoundError extends Error {
  constructor(readonly cid: string) {
    super(`No registration found for cid ${cid}`);
    this.name = "RunCredentialsNotFoundError";
  }
}
