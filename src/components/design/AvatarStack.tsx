const AVATARS = [
  { i: "MW", c: "#7C3AED" },
  { i: "PN", c: "#A855F7" },
  { i: "SK", c: "#10B981" },
  { i: "JP", c: "#F59E0B" },
  { i: "CR", c: "#EF4444" },
];

export function AvatarStack() {
  return (
    <div style={{ display: "flex", alignItems: "center" }} aria-label="50,000+ customers">
      {AVATARS.map((av, i) => (
        <div key={i} aria-hidden="true" title={av.i} style={{
          width: 30, height: 30, borderRadius: "50%", background: av.c, marginLeft: i > 0 ? -9 : 0,
          zIndex: 5 - i, position: "relative", border: "2px solid hsl(var(--background))",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 9, fontWeight: 700,
        }}>
          {av.i}
        </div>
      ))}
      <div aria-hidden="true" className="font-mono" style={{
        width: 30, height: 30, borderRadius: "50%", background: "hsl(var(--muted))",
        marginLeft: -9, zIndex: 0, border: "2px solid hsl(var(--background))", display: "flex",
        alignItems: "center", justifyContent: "center", color: "hsl(var(--muted-foreground))",
        fontSize: 7, fontWeight: 600,
      }}>+49K</div>
    </div>
  );
}
