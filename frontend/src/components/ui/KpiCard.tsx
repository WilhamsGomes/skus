import clsx from "clsx";
import type { ReactNode } from "react";

type Tone = "brand" | "accent" | "ok" | "warn" | "bad" | "violet";

const TONES: Record<Tone, string> = {
  brand: "text-brand bg-brand/10 ring-brand/30",
  accent: "text-accent bg-accent/10 ring-accent/30",
  ok: "text-ok bg-ok/10 ring-ok/30",
  warn: "text-warn bg-warn/10 ring-warn/30",
  bad: "text-bad bg-bad/10 ring-bad/30",
  violet: "text-violet bg-violet/10 ring-violet/30",
};

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  aside?: ReactNode;
}

export function KpiCard({ label, value, hint, icon, tone = "brand", aside }: KpiCardProps) {
  return (
    <div className="panel flex items-center gap-3 p-4">
      {aside ??
        (icon && (
          <div className={clsx("grid size-11 shrink-0 place-items-center rounded-xl ring-1", TONES[tone])}>
            {icon}
          </div>
        ))}
      <div className="min-w-0">
        <p className="panel-title">{label}</p>
        <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs leading-snug text-ink-muted">{hint}</p>}
      </div>
    </div>
  );
}
