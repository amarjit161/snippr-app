import { publicSupabase } from "@/integrations/supabase/publicClient";
import eventLogService from "@/services/eventLogService";
import { resolveRealtimeProtectionPolicy } from "@/lib/realtimeProtectionPolicy";
import realtimeProtectionService from "@/services/ops/realtimeProtectionService";

/**
 * RealtimeManager wraps a Supabase channel and provides:
 * - event sequencing / deduplication using `seq_id` from `queue_event_logs`
 * - reconnect recovery (resubscribe + fetch missing events)
 * - minimizes re-renders by applying per-row updates
 */
export function createRealtimeManager(
  salonId: string,
  handlers: {
    onEvent: (payload: any) => void;
    onReconnect?: () => void;
    onDelayedEvent?: (payload: any) => void;
    onDegradedMode?: (mode: "normal" | "degraded" | "shed" | "circuit_open", reason?: string) => void;
    onMetrics?: (metrics: {
      eventsTotal: number;
      dedupedEvents: number;
      delayedEvents: number;
      reconnectCount: number;
      orderingViolations: number;
      avgLatencyMs: number;
      p95LatencyMs: number;
      queueBacklog: number;
      shedEvents: number;
      circuitOpenSeconds: number;
      mode: "normal" | "degraded" | "shed" | "circuit_open";
    }) => void;
  }
) {
  const policy = resolveRealtimeProtectionPolicy();

  let lastSeq = 0;
  let channel: any = null;
  let reconnectCount = 0;
  let eventsTotal = 0;
  let dedupedEvents = 0;
  let delayedEvents = 0;
  let orderingViolations = 0;
  let shedEvents = 0;
  let mode: "normal" | "degraded" | "shed" | "circuit_open" = "normal";

  const reconnectTimes: number[] = [];
  let latencySamples: number[] = [];
  let eventQueue: any[] = [];
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  function nowMs() {
    return Date.now();
  }

  function calcLatencyStats() {
    if (latencySamples.length === 0) return { avg: 0, p95: 0 };
    const arr = [...latencySamples].sort((a, b) => a - b);
    const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    const p95 = arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.95))] || 0;
    return { avg, p95: Math.round(p95) };
  }

  function setMode(next: "normal" | "degraded" | "shed" | "circuit_open", reason?: string) {
    if (mode === next) return;
    mode = next;
    if (handlers.onDegradedMode) {
      handlers.onDegradedMode(next, reason);
    }
  }

  function emitMetrics() {
    const { avg, p95 } = calcLatencyStats();
    const st = (realtimeProtectionService as any).isCircuitOpen?.(salonId) ? 1 : 0;
    if (handlers.onMetrics) {
      handlers.onMetrics({
        eventsTotal,
        dedupedEvents,
        delayedEvents,
        reconnectCount,
        orderingViolations,
        avgLatencyMs: avg,
        p95LatencyMs: p95,
        queueBacklog: eventQueue.length,
        shedEvents,
        circuitOpenSeconds: st,
        mode,
      });
    }
  }

  function enqueueEvent(ev: any) {
    // Backpressure and load shedding: keep queue bounded and drop oldest when overloaded.
    if (eventQueue.length >= policy.maxBacklog) {
      eventQueue = eventQueue.slice(Math.floor(policy.maxBacklog * 0.25));
      shedEvents += 1;
      setMode("shed", "queue_backlog_limit");
      realtimeProtectionService.raiseAlert({ salonId, alertType: "QUEUE_LOAD_SHEDDING", severity: "warning", details: { backlog: eventQueue.length } });
    }
    eventQueue.push(ev);
  }

  function flushEventBatch() {
    if (eventQueue.length === 0) return;
    const allowed = eventQueue.splice(0, policy.maxBatchSize);
    for (const ev of allowed) {
      handlers.onEvent(ev);
    }
  }

  async function replayMissingEvents() {
    try {
      if (realtimeProtectionService.isCircuitOpen(salonId)) {
        setMode("circuit_open", "replay_skipped_circuit_open");
        return;
      }

      const { data } = await publicSupabase
        .from("queue_event_logs")
        .select("seq_id,event_type,payload,created_at")
        .gt("seq_id", lastSeq)
        .order("seq_id", { ascending: true })
        .limit(500);

      if (!data || data.length === 0) return;

      for (const item of data as any[]) {
        const rowSalonId = item?.payload?.salon_id || item?.payload?.new?.salon_id || item?.payload?.old?.salon_id;
        if (String(rowSalonId) !== String(salonId)) continue;
        if (item.seq_id <= lastSeq) {
          dedupedEvents += 1;
          continue;
        }

        // Distributed ordering safeguard
        if (lastSeq > 0 && item.seq_id !== lastSeq + 1) {
          orderingViolations += 1;
          realtimeProtectionService.raiseAlert({
            salonId,
            alertType: "EVENT_ORDER_GAP",
            severity: "warning",
            details: { expected: lastSeq + 1, got: item.seq_id },
          });
        }

        const ageMs = nowMs() - new Date(item.created_at).getTime();
        latencySamples.push(ageMs);
        if (latencySamples.length > 500) latencySamples = latencySamples.slice(-300);
        if (ageMs > policy.batchFlushMs * 20) {
          delayedEvents += 1;
        }

        lastSeq = item.seq_id;
        enqueueEvent({ type: item.event_type, payload: item.payload, seq: item.seq_id, source: "replay" });
        eventsTotal += 1;
      }
      emitMetrics();
    } catch (err) {
      console.warn("realtimeManager.replayMissingEvents.error", err);
    }
  }

  async function start() {
    flushTimer = setInterval(() => {
      flushEventBatch();
      emitMetrics();
    }, policy.batchFlushMs);

    channel = publicSupabase
      .channel(`owner-queue-${salonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_bookings', filter: `salon_id=eq.${salonId}` }, async (payload:any) => {
        try {
          if (realtimeProtectionService.isCircuitOpen(salonId)) {
            setMode("circuit_open", "incoming_event_blocked");
            return;
          }

          const tokenAllowed = await realtimeProtectionService.consumeSalonTokens(salonId, "realtime_events", 1);
          if (!tokenAllowed) {
            delayedEvents += 1;
            setMode("degraded", "salon_rate_limited");
            realtimeProtectionService.raiseAlert({ salonId, alertType: "SALON_RATE_LIMIT_HIT", severity: "warning" });
            return;
          }

          eventsTotal += 1;
          // conservative approach: fetch event logs for this row since lastSeq
          const logs = await eventLogService.tailByRow(payload.new?.id || payload.old?.id, lastSeq);
          if (logs && logs.length) {
            logs.forEach((l:any) => {
              if (l.seq_id <= lastSeq) {
                dedupedEvents += 1;
                return;
              }
              if (l.seq_id !== lastSeq + 1 && lastSeq > 0) {
                orderingViolations += 1;
              }
              lastSeq = l.seq_id;

              const ageMs = Date.now() - new Date(l.created_at).getTime();
              latencySamples.push(ageMs);
              if (latencySamples.length > 500) latencySamples = latencySamples.slice(-300);
              if (ageMs > 15000) {
                delayedEvents += 1;
                if (handlers.onDelayedEvent) handlers.onDelayedEvent(l);
              }

              enqueueEvent({ type: l.event_type, payload: l.payload, seq: l.seq_id });
            });

            if (eventQueue.length > policy.maxBacklog * 0.8) {
              setMode("degraded", "backpressure_high");
            }

            emitMetrics();
            return;
          }
          // fallback: pass payload directly
          enqueueEvent(payload);
          emitMetrics();
        } catch (err) {
          console.error('realtimeManager.event.error', err);
        }
      })
      .subscribe((status:any) => {
        if (status === 'SUBSCRIBED') {
          reconnectCount += 1;
          reconnectTimes.push(nowMs());
          while (reconnectTimes.length > 0 && nowMs() - reconnectTimes[0] > 60000) reconnectTimes.shift();

          if (reconnectTimes.length > policy.reconnectsPerMinThreshold) {
            realtimeProtectionService.openCircuit(salonId, policy.circuitOpenMs, "reconnect_storm");
            setMode("circuit_open", "reconnect_storm");
            const minuteBucket = new Date().toISOString().slice(0, 16);
            realtimeProtectionService.raiseAlert({
              salonId,
              alertType: "RECONNECT_STORM",
              severity: "critical",
              details: { reconnectsPerMin: reconnectTimes.length },
              dedupeKey: `RECONNECT_STORM:${salonId}:${minuteBucket}`,
              groupKey: `RECONNECT_STORM:${minuteBucket}`,
              cooldownSeconds: 120,
            });
            emitMetrics();
            return;
          }

          setMode("normal", "subscribed");
          replayMissingEvents();
          if (handlers.onReconnect) handlers.onReconnect();
          emitMetrics();
        }
      });
  }

  function stop() {
    if (channel) publicSupabase.removeChannel(channel);
    channel = null;
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  }

  async function recover() {
    // fetch latest seq and rehydrate missing events if any
    try {
      const { data } = await publicSupabase.from('queue_event_logs').select('seq_id').order('seq_id',{ascending:false}).limit(1).maybeSingle();
      if (data) lastSeq = data.seq_id;
      if (realtimeProtectionService.isCircuitOpen(salonId)) {
        setMode("circuit_open", "manual_recover_while_open");
        return;
      }
      await replayMissingEvents();
    } catch (err) {
      console.warn('realtimeManager.recover.error', err);
    }
  }

  return { start, stop, recover };
}

export default createRealtimeManager;
