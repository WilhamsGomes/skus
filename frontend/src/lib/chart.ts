export const CHART = {
  grid: "#1f2b48",
  axis: "#5d6a8a",
  brand: "#f97316",
  accent: "#38bdf8",
  violet: "#818cf8",
  ok: "#22c55e",
  warn: "#f59e0b",
  bad: "#ef4444",
  muted: "#334155",
} as const;

export const tooltipStyle = {
  contentStyle: {
    background: "#121b33",
    border: "1px solid #2b3a5e",
    borderRadius: 10,
    fontSize: 12,
    color: "#e6ebf5",
  },
  labelStyle: { color: "#94a0bd", marginBottom: 4 },
  itemStyle: { color: "#e6ebf5" },
  cursor: { fill: "rgba(148,160,189,0.08)" },
} as const;

export const axisProps = {
  stroke: CHART.axis,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;
