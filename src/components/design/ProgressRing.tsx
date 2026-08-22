export function ProgressRing({ pct, size = 140, stroke = 10 }: { pct: number; size?: number; stroke?: number }) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={pct >= 100 ? "hsl(var(--success))" : "hsl(var(--primary))"} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transformOrigin: "center", transform: "rotate(-90deg)", transition: "stroke-dashoffset 0.9s ease, stroke 0.3s ease" }} />
    </svg>
  );
}
