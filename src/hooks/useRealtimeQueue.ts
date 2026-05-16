import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import queueService from "@/services/queueService";
import queueSyncService from "@/services/queueSyncService";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import { toast } from "sonner";
import useQueueStateMachine from "@/hooks/useQueueStateMachine";
import { queueStateMachine, fromLegacyStatus } from "@/queue/stateMachine";
import queueLifecycleService from "@/services/queueLifecycleService";
import { buildTransitionEvent } from "@/queue/events";
import createRealtimeManager from "@/lib/realtimeManager";
import realtimeMetricsService from "@/services/ops/realtimeMetricsService";
import realtimeDebugService from "@/services/ops/realtimeDebugService";
import maintenanceModeService from "@/services/ops/maintenanceModeService";

/**
 * `useRealtimeQueue` aims to be a drop-in read-migration-friendly hook.
 * It preserves the public API shape used by `useQueue` but reads from the
 * canonical `queue_bookings` table and delegates writes to the sync service
 * (which performs dual-write during rollout).
 */
export function useRealtimeQueue(navigate: (path: string, options?: { replace?: boolean }) => void) {
  const ACCEPT_WINDOW_MS = 15000;

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [owner, setOwner] = useState<any | null>(null);
  const [salon, setSalon] = useState<any | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [pendingAccepts, setPendingAccepts] = useState<Record<string, number>>({});
  const acceptTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const recentEventIdsRef = useRef<Set<string>>(new Set());

  const queueStore = useQueueStateMachine([]);

  const sortedQueue = useMemo(() => {
    return [...queueItems].sort((a, b) => {
      const aPos = a.position ?? Number.MAX_SAFE_INTEGER;
      const bPos = b.position ?? Number.MAX_SAFE_INTEGER;
      if (aPos !== bPos) return aPos - bPos;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [queueItems]);

  const fetchQueue = useCallback(async (salonId: string) => {
    setLoading(true);
    try {
      const data = await queueService.listBySalon(salonId);
      setQueueItems(data);
      queueStore.dispatch({ type: "SET_ALL", items: data as any[] });
    } catch (err: any) {
      console.error("useRealtimeQueue.fetchQueue", err);
      toast.error(err.message || "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQueueItemFull = useCallback(async (queueId: string) => {
    try {
      return await queueService.getById(queueId);
    } catch (err) {
      console.error("fetchQueueItemFull", err);
      return null;
    }
  }, []);

  const mergeQueueItemUpdate = useCallback((payload: any) => {
    const { eventType, new: newRow, old: oldRow } = payload;
    setQueueItems((prev) => {
      if (eventType === "DELETE" && oldRow) {
        const eventId = `DELETE:${oldRow.id}:${oldRow.updated_at || oldRow.created_at || "na"}`;
        if (recentEventIdsRef.current.has(eventId)) return prev;
        recentEventIdsRef.current.add(eventId);
        if (recentEventIdsRef.current.size > 2000) recentEventIdsRef.current.clear();
        queueStore.dispatch({ type: "REMOVE", id: oldRow.id });
        return prev.filter((item) => item.id !== oldRow.id);
      }

      if (eventType === "INSERT" && newRow) {
        const eventId = `INSERT:${newRow.id}:${newRow.updated_at || newRow.created_at || "na"}`;
        if (recentEventIdsRef.current.has(eventId)) return prev;
        recentEventIdsRef.current.add(eventId);
        if (recentEventIdsRef.current.size > 2000) recentEventIdsRef.current.clear();
        fetchQueueItemFull(newRow.id).then((fullItem) => {
          if (fullItem) {
            setQueueItems((current) => {
              const exists = current.some((item) => item.id === fullItem.id);
              if (exists) return current;
              queueStore.dispatch({ type: "UPSERT", item: fullItem as any });
              return [fullItem, ...current];
            });
          }
        });
        return [{ ...newRow, services: null, barbers: null }, ...prev];
      }

      if (eventType === "UPDATE" && newRow) {
        const eventId = `UPDATE:${newRow.id}:${newRow.updated_at || newRow.created_at || "na"}`;
        if (recentEventIdsRef.current.has(eventId)) return prev;
        recentEventIdsRef.current.add(eventId);
        if (recentEventIdsRef.current.size > 2000) recentEventIdsRef.current.clear();
        fetchQueueItemFull(newRow.id).then((fullItem) => {
          if (fullItem) {
            queueStore.dispatch({ type: "UPSERT", item: fullItem as any });
            setQueueItems((current) => current.map((item) => (item.id === fullItem.id ? fullItem : item)));
          }
        });
        return prev.map((item) => (item.id === newRow.id ? { ...item, ...newRow } : item));
      }
      return prev;
    });
  }, [fetchQueueItemFull]);

  useEffect(() => {
    const raw = localStorage.getItem("owner");
    if (!raw) {
      navigate("/owner-login", { replace: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setOwner(parsed);
    } catch (err) {
      localStorage.removeItem("owner");
      navigate("/owner-login", { replace: true });
    }
  }, [navigate]);

  const bootstrap = useCallback(async () => {
    if (!owner) return;
    setLoading(true);
    try {
      const { data: salonData } = await publicSupabase.from("salons").select("id, name").eq("owner_id", owner.id).maybeSingle();
      const ownerSalon = salonData || null;
      setSalon(ownerSalon);

      if (!ownerSalon) {
        setServices([]);
        setBarbers([]);
        setQueueItems([]);
        return;
      }

      const [{ data: servicesData }, { data: barbersData }] = await Promise.all([
        publicSupabase.from("services").select("id, name, price, duration").eq("salon_id", ownerSalon.id).order("name"),
        publicSupabase.from("barbers").select("id, name, chair_number, specialization").eq("salon_id", ownerSalon.id).order("name"),
      ]);

      setServices(servicesData || []);
      setBarbers(barbersData || []);

      await fetchQueue(ownerSalon.id);
    } catch (err) {
      console.error("useRealtimeQueue.bootstrap", err);
    } finally {
      setLoading(false);
    }
  }, [owner, fetchQueue]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!salon?.id) return;
    let maintenanceEnabled = false;
    let lastEventTime = Date.now();
    const windowStart = new Date();
    let degradedMode: "normal" | "degraded" | "shed" | "circuit_open" = "normal";
    let latestMetrics = {
      eventsTotal: 0,
      dedupedEvents: 0,
      delayedEvents: 0,
      reconnectCount: 0,
      orderingViolations: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      queueBacklog: 0,
      shedEvents: 0,
      circuitOpenSeconds: 0,
      mode: "normal" as "normal" | "degraded" | "shed" | "circuit_open",
    };
    const manager = createRealtimeManager(salon.id, {
      onEvent: (payload) => {
        lastEventTime = Date.now();
        if (payload?.payload?.new || payload?.new || payload?.old) {
          mergeQueueItemUpdate(payload.payload || payload);
        }
      },
      onReconnect: () => {
        queueLifecycleService.log({
          name: "WEBSOCKET_RECOVERED",
          queueId: "system",
          salonId: salon.id,
          payload: { actor: "system" },
          occurredAt: new Date().toISOString(),
        });
      },
      onDelayedEvent: async (ev) => {
        // Capture delayed events for operational replay tooling.
        const queueId = ev?.payload?.new?.id || ev?.payload?.id || ev?.row_id || null;
        await realtimeDebugService.enqueueDelayedEvent({
          salonId: salon.id,
          queueId,
          eventType: "DELAYED_REALTIME_EVENT",
          payload: { raw: ev },
          delayMs: 1000,
        }).catch(() => {});
      },
      onMetrics: (m) => {
        latestMetrics = m;
      },
      onDegradedMode: (mode, reason) => {
        degradedMode = mode;
        if (mode === "circuit_open") {
          toast.warning("Realtime temporarily degraded. Recovery mode is active.");
        }
        if (reason) {
          queueLifecycleService.log({
            name: "WEBSOCKET_RECOVERED",
            queueId: "system",
            salonId: salon.id,
            payload: { actor: "system", mode, reason },
            occurredAt: new Date().toISOString(),
          }).catch(() => {});
        }
      },
    });

    maintenanceModeService.get(salon.id).then((m) => {
      maintenanceEnabled = Boolean(m?.enabled);
      if (maintenanceEnabled) {
        toast.info("Maintenance mode active: realtime switched to safe fallback.");
        return;
      }
      manager.start();
    }).catch(() => {
      manager.start();
    });

    const flushMetrics = setInterval(() => {
      const windowEnd = new Date();
      realtimeMetricsService.recordWindow({
        salonId: salon.id,
        metricWindowStart: windowStart.toISOString(),
        metricWindowEnd: windowEnd.toISOString(),
        eventsTotal: latestMetrics.eventsTotal,
        delayedEvents: latestMetrics.delayedEvents,
        dedupedEvents: latestMetrics.dedupedEvents,
        reconnectCount: latestMetrics.reconnectCount,
        conflictCount: latestMetrics.orderingViolations,
        avgLatencyMs: latestMetrics.avgLatencyMs,
        p95LatencyMs: latestMetrics.p95LatencyMs,
        queueBacklog: latestMetrics.queueBacklog,
        shedEvents: latestMetrics.shedEvents,
        circuitOpenSeconds: latestMetrics.circuitOpenSeconds,
        mode: latestMetrics.mode,
      }).catch(() => {});
    }, 60000);

    const onOnline = () => {
      if (!maintenanceEnabled) {
        manager.recover();
      }
    };
    window.addEventListener("online", onOnline);

    // Fallback: only when no events for 60s
    const interval = setInterval(async () => {
      const now = Date.now();
      const stallThreshold = degradedMode === "normal" ? 60000 : 20000;
      if (maintenanceEnabled || now - lastEventTime > stallThreshold) {
        try {
          const { data } = await publicSupabase.from("queue_bookings").select("id").eq("salon_id", salon.id).order("created_at", { ascending: false }).limit(1);
          if (data && data.length > 0) {
            const latestId = data[0].id;
            const currentLatestId = queueItems?.[0]?.id;
            if (latestId !== currentLatestId) {
              fetchQueue(salon.id);
            }
          }
        } catch (err) {
          console.error("useRealtimeQueue.fallback", err);
        }
      }
    }, 30000);

    return () => {
      manager.stop();
      clearInterval(interval);
      clearInterval(flushMetrics);
      window.removeEventListener("online", onOnline);
    };
  }, [salon?.id, mergeQueueItemUpdate, fetchQueue, queueItems]);

  // Writes go through queueSyncService to ensure dual-write during rollout
  const addWalkIn = useCallback(async (payload: any) => {
    if (!salon) {
      toast.error("Salon not found");
      return;
    }
    try {
      const result = await queueSyncService.dualCreate({ salon_id: salon.id, ...payload });
      if (result?.canonical) {
        setQueueItems((prev) => [...prev, result.canonical]);
        toast.success("Walk-in added");
      }
    } catch (err: any) {
      console.error("addWalkIn", err);
      toast.error(err.message || "Failed to add walk-in");
    }
  }, [salon]);

  const updateStatus = useCallback(async (queueId: string, status: string) => {
    const previous = queueItems;
    const now = new Date().toISOString();
    const before = previous.find((item) => item.id === queueId);
    if (before) {
      const from = fromLegacyStatus(String(before.status));
      const to = fromLegacyStatus(String(status));
      queueStateMachine.assertTransition(from, to, { actor: "owner" });
    }

    setQueueItems((prev) => prev.map((item) => (item.id === queueId ? { ...item, status } : item)));

    setActionLoading(queueId);
    try {
      const payload: Record<string, any> = { status };
      if (status === "in_progress") payload.started_at = now;
      if (status === "completed") payload.completed_at = now;

      const expectedVersion = Number(before?.row_version || 0);
      await queueSyncService.dualUpdateWithVersion(queueId, expectedVersion, payload);

      if (before) {
        await queueLifecycleService.log(buildTransitionEvent(before, String(before.status), status, { actor: "owner" }));
      }

      toast.success(`Status updated to ${status}`);
    } catch (err: any) {
      setQueueItems(previous);
      toast.error(err.message || "Failed to update status");
    } finally {
      setActionLoading(null);
    }
  }, [queueItems]);

  const startAccept = useCallback(async (queueId: string) => {
    await updateStatus(queueId, "accepted");
    const expiresAt = Date.now() + ACCEPT_WINDOW_MS;
    const timer = setTimeout(async () => {
      delete acceptTimersRef.current[queueId];
      setPendingAccepts((prev) => {
        const next = { ...prev };
        delete next[queueId];
        return next;
      });
      await updateStatus(queueId, "in_progress");
    }, ACCEPT_WINDOW_MS);
    acceptTimersRef.current[queueId] = timer;
    setPendingAccepts((prev) => ({ ...prev, [queueId]: expiresAt }));
  }, [updateStatus]);

  const undoAccept = useCallback(async (queueId: string) => {
    const timer = acceptTimersRef.current[queueId];
    if (timer) clearTimeout(timer);
    delete acceptTimersRef.current[queueId];
    setPendingAccepts((prev) => {
      const next = { ...prev };
      delete next[queueId];
      return next;
    });
    await updateStatus(queueId, "waiting");
  }, [updateStatus]);

  const updateBarber = useCallback(async (queueId: string, barberId: string | null) => {
    const previous = queueItems;
    setQueueItems((prev) => prev.map((item) => (item.id === queueId ? { ...item, barber_id: barberId } : item)));
    try {
      await queueSyncService.dualUpdate(queueId, { barber_id: barberId });
      toast.success("Barber updated");
    } catch (err: any) {
      setQueueItems(previous);
      toast.error(err.message || "Failed to assign barber");
    }
  }, [queueItems]);

  const grouped = useMemo(() => {
    const waiting = sortedQueue.filter((item) => item.status === "waiting" || item.status === "arriving" || item.status === "confirmed");
    const inProgress = sortedQueue.filter((item) => item.status === "in_progress" || item.status === "accepted" || item.status === "seated");
    const completed = sortedQueue.filter((item) => item.status === "completed");
    const cancelled = sortedQueue.filter((item) => item.status === "cancelled" || item.status === "rejected" || item.status === "expired" || item.status === "no_show");
    return { waiting, inProgress, completed, cancelled };
  }, [sortedQueue]);

  return {
    loading,
    actionLoading,
    owner,
    salon,
    services,
    barbers,
    queueItems: sortedQueue,
    grouped,
    pendingAccepts,
    startAccept,
    undoAccept,
    fetchQueue,
    addWalkIn,
    updateStatus,
    updateBarber,
  };
}

export default useRealtimeQueue;
