const integer = new Intl.NumberFormat("pt-BR");
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" });
const time = new Intl.DateTimeFormat("pt-BR", { timeStyle: "medium" });

export const DASH = "—";

export function formatInt(value: number | null | undefined): string {
  return value === null || value === undefined ? DASH : integer.format(value);
}

export function formatPrice(value: number | null | undefined): string {
  return value === null || value === undefined ? DASH : decimal.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? DASH : percent.format(value);
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  if (value < 1000) return `${Math.round(value)} ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(1).replace(".", ",")} s`;
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.round((value % 60_000) / 1000);
  return `${minutes} min ${seconds} s`;
}

export function formatDateTime(value: string | number | null | undefined): string {
  return value === null || value === undefined ? DASH : dateTime.format(new Date(value));
}

export function formatTime(value: string | number | null | undefined): string {
  return value === null || value === undefined ? DASH : time.format(new Date(value));
}

export function formatRelative(value: string | number | null | undefined, now = Date.now()): string {
  if (value === null || value === undefined) return DASH;
  const seconds = Math.round((now - new Date(value).getTime()) / 1000);
  if (seconds < 5) return "agora";
  if (seconds < 60) return `há ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}

export function formatUptime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return DASH;
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

export function shortId(value: string, size = 8): string {
  return value.length > size ? `${value.slice(0, size)}…` : value;
}

export function runDurationMs(run: { startedAt: string; callbackSentAt: string | null }): number | null {
  if (!run.callbackSentAt) return null;
  return new Date(run.callbackSentAt).getTime() - new Date(run.startedAt).getTime();
}
