interface Segment {
  value: number;
  className: string;
  label: string;
}

interface ProgressBarProps {
  total: number;
  segments: Segment[];
  height?: string;
}

export function ProgressBar({ total, segments, height = "h-2" }: ProgressBarProps) {
  const safeTotal = Math.max(total, 1);
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-surface-3 ${height}`}>
      {segments.map((segment) =>
        segment.value > 0 ? (
          <div
            key={segment.label}
            title={`${segment.label}: ${segment.value}`}
            className={`${segment.className} transition-[width] duration-500`}
            style={{ width: `${Math.min(100, (segment.value / safeTotal) * 100)}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

export function RunProgress({
  total,
  enriched,
  failed,
  pending,
}: {
  total: number;
  enriched: number;
  failed: number;
  pending: number;
}) {
  return (
    <ProgressBar
      total={total}
      segments={[
        { value: enriched, className: "bg-ok", label: "Enriquecidos" },
        { value: failed, className: "bg-bad", label: "Falharam" },
        { value: pending, className: "bg-warn/70", label: "Pendentes" },
      ]}
    />
  );
}
