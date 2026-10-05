interface ScoreRingProps {
  value: number | null;
  max?: number;
  size?: number;
  stroke?: number;
  label?: string;
  color?: string;
}

export function ScoreRing({ value, max = 100, size = 56, stroke = 6, label, color }: ScoreRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = value === null ? 0 : Math.max(0, Math.min(1, value / max));
  const tone = color ?? (ratio >= 1 ? "var(--color-ok)" : ratio >= 0.7 ? "var(--color-brand)" : "var(--color-bad)");

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute text-xs font-semibold tabular-nums text-ink">
        {label ?? (value === null ? "—" : Math.round(value))}
      </span>
    </div>
  );
}
