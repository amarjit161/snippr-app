import { publicSupabase } from "@/integrations/supabase/publicClient";

export const realtimeMetricsService = {
  async recordWindow(input: {
    salonId: string;
    metricWindowStart: string;
    metricWindowEnd: string;
    eventsTotal: number;
    delayedEvents: number;
    dedupedEvents: number;
    reconnectCount: number;
    conflictCount: number;
    avgLatencyMs?: number;
    p95LatencyMs?: number;
    queueBacklog?: number;
    shedEvents?: number;
    circuitOpenSeconds?: number;
    mode?: "normal" | "degraded" | "shed" | "circuit_open";
  }) {
    const payload = {
      salon_id: input.salonId,
      metric_window_start: input.metricWindowStart,
      metric_window_end: input.metricWindowEnd,
      events_total: input.eventsTotal,
      delayed_events: input.delayedEvents,
      deduped_events: input.dedupedEvents,
      reconnect_count: input.reconnectCount,
      conflict_count: input.conflictCount,
      avg_latency_ms: input.avgLatencyMs ?? 0,
      p95_latency_ms: input.p95LatencyMs ?? 0,
      queue_backlog: input.queueBacklog ?? 0,
      shed_events: input.shedEvents ?? 0,
      circuit_open_seconds: input.circuitOpenSeconds ?? 0,
      mode: input.mode ?? "normal",
    };
    const { error } = await publicSupabase.from("realtime_metrics_aggregates").insert(payload);
    if (error) throw error;
  },

  async recentWindows(salonId: string, limit = 48) {
    const { data, error } = await publicSupabase
      .from("realtime_metrics_aggregates")
      .select("*")
      .eq("salon_id", salonId)
      .order("metric_window_start", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },
};

export default realtimeMetricsService;
