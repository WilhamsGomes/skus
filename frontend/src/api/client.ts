const TOKEN_KEY = "sku-dashboard.token";
const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      return;
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      return;
    }
  },
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Não foi possível falar com o backend. Ele está rodando?", null);
  }

  const text = await response.text();
  const body: unknown = text ? safeJson(text) : null;

  if (response.status === 401 && !path.startsWith("/auth/login")) {
    tokenStore.clear();
    unauthorizedHandler?.();
  }
  if (!response.ok) throw new ApiError(response.status, errorMessage(response.status, body), body);

  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(status: number, body: unknown): string {
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    if (typeof record.reason === "string") return `${String(record.error ?? "erro")}: ${record.reason}`;
    if (Array.isArray(record.message)) return record.message.join(", ");
    if (typeof record.message === "string") return record.message;
  }
  if (typeof body === "string" && body) return body;
  return `Erro ${status}`;
}
