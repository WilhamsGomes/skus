import { Inject, Injectable } from "@nestjs/common";
import {
  APP_CONFIG,
  type AppConfig,
} from "../../../../shared/config/app-config";
import type { PlatformCredentials } from "../../../registration/domain/registration";
import { PlatformUnavailableError } from "../../../registration/application/registration.errors";
import type {
  BatchPlatformClient,
  BurstTicket,
} from "../../application/ports/batch-platform.client";

const BURST_TIMEOUT_MS = 10_000;

@Injectable()
export class BatchPlatformHttpClient implements BatchPlatformClient {
  private readonly baseUrl: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.baseUrl = config.platformBaseUrl;
  }

  async requestBurst({
    cid,
    token,
  }: PlatformCredentials): Promise<BurstTicket> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/burst/${encodeURIComponent(cid)}`,
        {
          method: "POST",
          headers: { "x-token": token },
          signal: AbortSignal.timeout(BURST_TIMEOUT_MS),
        },
      );
    } catch (error) {
      throw new PlatformUnavailableError(
        "POST /burst failed before a response",
        { cause: error },
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new PlatformUnavailableError(
        `POST /burst responded ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }

    const body = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const runId = body?.run_id;
    const total = body?.total;
    const startedAt =
      typeof body?.started_at === "string"
        ? new Date(body.started_at)
        : undefined;

    if (
      typeof runId !== "string" ||
      runId === "" ||
      !Number.isInteger(total) ||
      (total as number) < 0 ||
      !startedAt ||
      Number.isNaN(startedAt.getTime())
    ) {
      throw new PlatformUnavailableError(
        "POST /burst response is missing run_id, total or started_at",
      );
    }
    return { runId, total: total as number, startedAt };
  }
}
