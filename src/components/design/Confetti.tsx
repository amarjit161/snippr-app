// Fixed decorative particle palette — not tokenized, matches the source design's confetti burst.
const COLORS = ["#7C3AED", "#A855F7", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899"];

export function Confetti() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 5 }} aria-hidden="true">
      {Array.from({ length: 42 }).map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${(i * 2.4) % 100}%`,
          top: -16,
          width: 5 + (i % 6),
          height: 5 + (i % 6),
          background: COLORS[i % COLORS.length],
          borderRadius: i % 3 === 0 ? "50%" : 2,
          animation: `confettiFall ${1.1 + (i % 4) * 0.2}s ease ${i * 0.035}s forwards`,
        }} />
      ))}
    </div>
  );
}
