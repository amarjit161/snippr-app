import { V, G, BODY } from "../../landing/tokens";
import { AppNav } from "./AppNav";
import type { AppTab } from "./types";

export function HomeScreen({ onTabChange }: { onTabChange?: (t: AppTab) => void }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", paddingTop: 36, fontFamily: BODY }}>
      <div style={{ padding: "6px 16px 10px" }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)" }}>Monday, June 22</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>Good morning, Marcus 👋</div>
      </div>
      <div style={{ margin: "0 12px 10px", borderRadius: 14, padding: "10px 12px",
        background: `${V}16`, border: `1px solid ${V}30` }}>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>Next Appointment</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>Haircut · Fade District</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Tomorrow · 2:00 PM · James B.</div>
      </div>
      <div style={{ padding: "0 16px 6px", fontSize: 8, fontWeight: 500, color: "rgba(255,255,255,0.22)", letterSpacing: "0.14em", fontFamily: "'DM Mono','Courier New',monospace" }}>NEARBY SALONS</div>
      <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 5, flex: 1, marginBottom: 60 }}>
        {[
          { n: "Fade District",  w: "12 min", s: "Open",  c: G        },
          { n: "Salon Lumière",  w: "8 min",  s: "Open",  c: G        },
          { n: "Fresh Cuts Co.", w: "4 min",  s: "Busy",  c: "#F59E0B" },
        ].map(r => (
          <div key={r.n} style={{ borderRadius: 12, padding: "9px 12px", display: "flex",
            alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.035)" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#fff" }}>{r.n}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>{r.w} walk</div>
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, color: r.c }}>{r.s}</div>
          </div>
        ))}
      </div>
      <AppNav active="Home" onTabChange={onTabChange} />
    </div>
  );
}
