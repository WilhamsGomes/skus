import clsx from "clsx";

type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "brand";

const TONES: Record<Tone, string> = {
  ok: "bg-ok/10 text-ok ring-ok/30",
  warn: "bg-warn/10 text-warn ring-warn/30",
  bad: "bg-bad/10 text-bad ring-bad/30",
  info: "bg-accent/10 text-accent ring-accent/30",
  brand: "bg-brand/10 text-brand ring-brand/30",
  neutral: "bg-surface-3 text-ink-muted ring-line-strong",
};

const STATUS_TONES: Record<string, Tone> = {
  ENRICHED: "ok",
  COMPLETED: "ok",
  completed: "ok",
  FAILED: "bad",
  failed: "bad",
  RECEIVED: "warn",
  OPEN: "info",
  active: "info",
  waiting: "neutral",
  delayed: "warn",
  prioritized: "neutral",
};

const STATUS_LABELS: Record<string, string> = {
  ENRICHED: "Enriquecido",
  COMPLETED: "Concluído",
  FAILED: "Falhou",
  RECEIVED: "Recebido",
  OPEN: "Em andamento",
  completed: "concluído",
  failed: "falhou",
  active: "ativo",
  waiting: "aguardando",
  delayed: "nova tentativa",
  prioritized: "priorizado",
};

interface StatusBadgeProps {
  status?: string;
  tone?: Tone;
  label?: string;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, tone, label, pulse, className }: StatusBadgeProps) {
  const resolvedTone = tone ?? (status ? STATUS_TONES[status] : undefined) ?? "neutral";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1",
        TONES[resolvedTone],
        className,
      )}
    >
      <span className={clsx("size-1.5 rounded-full bg-current", pulse && "animate-pulse")} />
      {label ?? (status ? (STATUS_LABELS[status] ?? status) : "")}
    </span>
  );
}

export function PassBadge({ pass, label }: { pass: boolean | null; label: string }) {
  if (pass === null) return <StatusBadge tone="neutral" label={`${label}: —`} />;
  return <StatusBadge tone={pass ? "ok" : "bad"} label={`${label}: ${pass ? "ok" : "falhou"}`} />;
}
