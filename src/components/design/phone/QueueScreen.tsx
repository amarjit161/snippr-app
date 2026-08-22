import { BODY } from "../../landing/tokens";
import { AppNav } from "./AppNav";
import { JourneyScreen } from "./JourneyScreen";
import type { AppTab } from "./types";

export function QueueScreen({ onTabChange }: { onTabChange?: (t: AppTab) => void }) {
  return (
    <div style={{ height: "100%", fontFamily: BODY, position: "relative" }}>
      <JourneyScreen step={4} />
      <AppNav active="Queue" onTabChange={onTabChange} />
    </div>
  );
}
