import { V, G, BODY } from "../../landing/tokens";
import { AppNav } from "./AppNav";
import type { AppTab } from "./types";

export function AlertsScreen({ onTabChange }: { onTabChange?: (t: AppTab) => void }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", paddingTop: 36, fontFamily: BODY }}>
      <div style={{ padding: "6px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>Notifications</div>
      </div>
      <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5, overflow: "hidden", marginBottom: 60 }}>
        {[
          { t: "You're up next!",          s: "Fade District · 2 min ago",   c: V           },
          { t: "Booking confirmed",         s: "Tomorrow at 2:00 PM",         c: G           },
          { t: "Marcus is ready for you",  s: "Walk in now · Just now",      c: G           },
          { t: "Appointment reminder",      s: "Tomorrow at 1:30 PM",         c: "#52525B"   },
          { t: "Queue update",              s: "5 min shorter than expected", c: "#52525B"   },
        ].map((n, i) => (
          <div key={i} style={{ borderRadius: 12, padding: "9px 12px", display: "flex",
            alignItems: "flex-start", gap: 8, background: "rgba(255,255,255,0.03)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: n.c, flexShrink: 0, marginTop: 4 }} aria-hidden="true" />
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#fff" }}>{n.t}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", marginTop: 2 }}>{n.s}</div>
            </div>
          </div>
        ))}
      </div>
      <AppNav active="Alerts" onTabChange={onTabChange} />
    </div>
  );
}
