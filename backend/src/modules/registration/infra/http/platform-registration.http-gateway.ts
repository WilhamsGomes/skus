import { Inject, Injectable } from "@nestjs/common";
import {
  APP_CONFIG,
  type AppConfig,
} from "../../../../shared/config/app-config";
import type { PlatformCredentials } from "../../domain/registration";
import type { PlatformRegistrationGateway } from "../../application/ports/platform-registration.gateway";
import {
  HandshakeFailedError,
  PlatformUnavailableError,
} from "../../application/registration.errors";

/** Folga para o handshake: a plataforma chama nosso /check antes de responder. */
const REGISTER_TIMEOUT_MS = 15_000;

/** Adapter HTTP do POST /register. Payloads e status da plataforma não saem daqui. */
@Injectable()
export class PlatformRegistrationHttpGateway implements PlatformRegistrationGateway {
  private readonly baseUrl: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.baseUrl = config.platformBaseUrl;
  }

  async register(input: {
    name: string;
    webhook: string;
  }): Promise<PlatformCredentials> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(REGISTER_TIMEOUT_MS),
      });
    } catch (error) {
      throw new PlatformUnavailableError(
        "POST /register failed before a response",
        { cause: error },
      );
    }

    const body: unknown = await response.json().catch(() => null);

    if (response.status === 422) {
      throw new HandshakeFailedError(
        readString(body, "reason") ?? "no reason given",
      );
    }
    if (!response.ok) {
      throw new PlatformUnavailableError(
        `POST /register responded ${response.status}`,
      );
    }

    const cid = readString(body, "cid");
    const token = readString(body, "token");
    if (!cid || !token) {
      throw new PlatformUnavailableError(
        "POST /register response is missing cid or token",
      );
    }
    return { cid, token };
  }
}

function readString(body: unknown, key: string): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
