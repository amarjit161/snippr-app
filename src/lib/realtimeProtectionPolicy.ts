export type RealtimeProtectionPolicy = {
  batchFlushMs: number;
  maxBatchSize: number;
  maxBacklog: number;
  reconnectsPerMinThreshold: number;
  delayedEventsPerMinThreshold: number;
  circuitOpenMs: number;
  mobileBandwidthMode: "normal" | "constrained";
};

export function resolveRealtimeProtectionPolicy(): RealtimeProtectionPolicy {
  let mobileBandwidthMode: "normal" | "constrained" = "normal";

  try {
    const nav: any = navigator;
    const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
    const effectiveType = String(conn?.effectiveType || "").toLowerCase();
    const saveData = Boolean(conn?.saveData);
    if (saveData || effectiveType.includes("2g") || effectiveType.includes("3g")) {
      mobileBandwidthMode = "constrained";
    }
  } catch (err) {
    // ignore env differences
  }

  if (mobileBandwidthMode === "constrained") {
    return {
      batchFlushMs: 500,
      maxBatchSize: 40,
      maxBacklog: 300,
      reconnectsPerMinThreshold: 8,
      delayedEventsPerMinThreshold: 20,
      circuitOpenMs: 20000,
      mobileBandwidthMode,
    };
  }

  return {
    batchFlushMs: 250,
    maxBatchSize: 100,
    maxBacklog: 600,
    reconnectsPerMinThreshold: 12,
    delayedEventsPerMinThreshold: 35,
    circuitOpenMs: 15000,
    mobileBandwidthMode,
  };
}
