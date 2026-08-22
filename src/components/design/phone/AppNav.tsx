import { Home, Calendar, Clock, Bell, User } from "lucide-react";
import { V, MONO } from "../../landing/tokens";
import { APP_TABS } from "./types";
import type { AppTab } from "./types";

const TAB_ICONS: Record<AppTab, React.ReactNode> = {
  Home:    <Home    style={{ width: 15, height: 15 }} />,
  Book:    <Calendar style={{ width: 15, height: 15 }} />,
  Queue:   <Clock   style={{ width: 15, height: 15 }} />,
  Alerts:  <Bell    style={{ width: 15, height: 15 }} />,
  Profile: <User    style={{ width: 15, height: 15 }} />,
};

export function AppNav({ active, onTabChange }: { active: AppTab; onTabChange?: (t: AppTab) => void }) {
  return (
    <nav aria-label="App navigation"
      style={{ position: "absolute", bottom: 0, left: 0, right: 0,
        borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(5,5,7,0.92)",
        backdropFilter: "blur(16px)", display: "flex", justifyContent: "space-around",
        padding: "9px 4px 16px", zIndex: 10 }}>
      {APP_TABS.map(tab => {
        const on = active === tab;
        return (
          <button key={tab} onClick={() => onTabChange?.(tab)} aria-label={tab} aria-current={on ? "page" : undefined}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              color: on ? V : "rgba(255,255,255,0.3)", background: "none", border: "none",
              cursor: "pointer", padding: "2px 8px", borderRadius: 8,
              transition: "color 0.2s ease, transform 0.2s ease",
              transform: on ? "translateY(-1px)" : "none" }}>
            {TAB_ICONS[tab]}
            <div style={{ fontSize: 7, fontFamily: MONO, fontWeight: on ? 600 : 400 }}>{tab}</div>
            {on && <div style={{ width: 3, height: 3, borderRadius: "50%", background: V, marginTop: -1 }} />}
          </button>
        );
      })}
    </nav>
  );
}
