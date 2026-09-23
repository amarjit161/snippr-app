import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type OwnerRecord = {
  id: string;
  name: string;
  email: string;
};

type SalonRow = {
  id: string;
  name: string;
};

type ServiceRow = {
  id: string;
  name: string;
  price: number;
  duration: number;
};

type BarberRow = {
  id: string;
  name: string;
  chair_number: number | null;
  specialization: string | null;
};

type QueueItem = {
  id: string;
  created_at: string;
  status: "pending" | "waiting" | "accepted" | "in_progress" | "completed" | "cancelled";
  user_id: string | null;
  service_id: string;
  barber_id: string | null;
  position: number | null;
  started_at: string | null;
  completed_at: string | null;
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  customer_phone?: string | null;
  booking_date?: string | null;
  time_slot?: string | null;
  notes?: string | null;
  source?: string | null;
  services?: ServiceRow | null;
  barbers?: BarberRow | null;
};

type WalkInPayload = {
  customerFirstName: string;
  customerLastName: string;
  phoneNumber: string;
  serviceId: string;
  barberId: string;
  // Explicit, not inferred from whether email is present — "existing" always
  // requires and looks up email server-side; "guest" never does, even if an
  // email string happens to be set.
  customerMode: "existing" | "guest";
  email?: string;
};

const normalizeQueueItem = (item: any): QueueItem => {
  if (!item) return item;
  return {
    ...item,
    user_id: item.customer_id || item.user_id,
    barber_id: item.stylist_id || item.barber_id,
    time_slot: item.booking_time || item.time_slot,
    arrival_otp: item.otp || item.arrival_otp,
    barbers: item.barbers || null,
  };
};

export function useQueue(navigate: (path: string, options?: { replace?: boolean }) => void) {
  const supabaseAny = supabase as any;
  const ACCEPT_WINDOW_MS = 15000;

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [salon, setSalon] = useState<SalonRow | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [barbers, setBarbers] = useState<BarberRow[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [pendingAccepts, setPendingAccepts] = useState<Record<string, number>>({});
  const acceptTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  // Mirrors queueItems for the realtime effect's fallback-sync check below, so that
  // effect doesn't need queueItems in its dependency array (which previously caused
  // the whole channel to unsubscribe/resubscribe on every single queue update — a
  // window where a same-moment realtime event could be missed).
  const queueItemsRef = useRef<QueueItem[]>([]);
  useEffect(() => {
    queueItemsRef.current = queueItems;
  }, [queueItems]);

  const sortedQueue = useMemo(() => {
    return [...queueItems].sort((a, b) => {
      const aPos = a.position ?? Number.MAX_SAFE_INTEGER;
      const bPos = b.position ?? Number.MAX_SAFE_INTEGER;
      if (aPos !== bPos) return aPos - bPos;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [queueItems]);

  const fetchQueue = useCallback(async (salonId: string) => {
    console.log("FETCH_QUEUE_START", salonId);
    const { data, error } = await supabaseAny
      .from("bookings")
      .select(`
        *,
        services (*),
        salons (*),
        barbers (*)
      `)
      .eq("salon_id", salonId)
      .order("position", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("FETCH_QUEUE_ERROR", error.message);
      toast.error(error.message || "Failed to load queue");
      return;
    }

    console.log("FETCH_QUEUE_SUCCESS", data?.length, "items:", data?.map((item: any) => ({ id: item.id, status: item.status })));
    setQueueItems((((data || []) as any[]).map(normalizeQueueItem)) || []);
  }, [supabaseAny]);

  const clearAcceptTimer = useCallback((queueId: string) => {
    const timer = acceptTimersRef.current[queueId];
    if (timer) {
      clearTimeout(timer);
    }
    delete acceptTimersRef.current[queueId];
    setPendingAccepts((prev) => {
      if (!prev[queueId]) return prev;
      const next = { ...prev };
      delete next[queueId];
      return next;
    });
  }, [acceptTimersRef]);

  useEffect(() => {
    const acceptedIds = new Set(queueItems.filter((item) => item.status === "accepted").map((item) => item.id));
    setPendingAccepts((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach((queueId) => {
        if (!acceptedIds.has(queueId)) {
          changed = true;
          delete next[queueId];
          const timer = acceptTimersRef.current[queueId];
          if (timer) clearTimeout(timer);
          delete acceptTimersRef.current[queueId];
        }
      });
      return changed ? next : prev;
    });
  }, [acceptTimersRef, queueItems]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    const raw = localStorage.getItem("owner");
    if (!raw) {
      navigate("/owner-login", { replace: true });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as OwnerRecord;
      setOwner(parsed);

      const { data: salonData, error: salonError } = await supabaseAny
        .from("salons")
        .select("id, name")
        .eq("owner_id", parsed.id)
        .maybeSingle();

      if (salonError) throw salonError;

      const ownerSalon = (salonData as SalonRow) || null;
      setSalon(ownerSalon);

      if (!ownerSalon) {
        setServices([]);
        setBarbers([]);
        setQueueItems([]);
        setLoading(false);
        return;
      }

      const [{ data: servicesData }, { data: barbersData }] = await Promise.all([
        supabaseAny.from("services").select("id, name, price, duration").eq("salon_id", ownerSalon.id).order("name"),
        supabaseAny.from("barbers").select("id, name, chair_number, specialization").eq("salon_id", ownerSalon.id).order("name"),
      ]);

      setServices((servicesData as ServiceRow[]) || []);
      setBarbers((barbersData as BarberRow[]) || []);

      await fetchQueue(ownerSalon.id);
    } catch (error) {
      console.error("Queue bootstrap failed", error);
      localStorage.removeItem("owner");
      navigate("/owner-login", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [fetchQueue, navigate, supabaseAny]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Fetch full queue item with all relations
  const fetchQueueItemFull = useCallback(async (queueId: string) => {
    try {
      const { data } = await supabaseAny
        .from("bookings")
        .select("*, services (*), barbers (*), salons (*)")
        .eq("id", queueId)
        .maybeSingle();
      return normalizeQueueItem(data);
    } catch (err) {
      console.error("FETCH_QUEUE_ITEM_ERROR", err);
      return null;
    }
  }, [supabaseAny]);

  // Intelligent merge for real-time updates (no flicker)
  const mergeQueueItemUpdate = useCallback((payload: any) => {
    const { eventType, new: newRow, old: oldRow } = payload;

    setQueueItems((prev) => {
      if (eventType === "DELETE" && oldRow) {
        return prev.filter((item) => item.id !== oldRow.id);
      }

      if (eventType === "INSERT" && newRow) {
        // Fetch full item asynchronously
        fetchQueueItemFull(newRow.id).then((fullItem) => {
          if (fullItem) {
            setQueueItems((current) => {
              const exists = current.some((item) => item.id === fullItem.id);
              if (exists) return current;
              return [fullItem, ...current];
            });
          }
        });
        // Add placeholder immediately. Routed through normalizeQueueItem — the raw
        // realtime payload only has the bookings table's own columns (e.g.
        // customer_id), not the derived fields (user_id, arrival_otp, etc.) other
        // code in this hook/its consumers read unconditionally.
        return [normalizeQueueItem({ ...newRow, services: null, barbers: null }), ...prev];
      }

      if (eventType === "UPDATE" && newRow) {
        // Fetch full item asynchronously to get latest data
        fetchQueueItemFull(newRow.id).then((fullItem) => {
          if (fullItem) {
            setQueueItems((current) =>
              current.map((item) => (item.id === fullItem.id ? fullItem : item))
            );
          }
        });
        // Update optimistically first. Normalized for the same reason as the INSERT
        // branch above — spreading the raw payload directly overwrote already-
        // normalized fields (e.g. user_id) with the raw row's undefined equivalents.
        return prev.map((item) => (item.id === newRow.id ? normalizeQueueItem({ ...item, ...newRow }) : item));
      }

      return prev;
    });
  }, [fetchQueueItemFull]);

  useEffect(() => {
    if (!salon?.id) return;

    console.log("QUEUE_REALTIME_SUBSCRIPTION_START", salon.id);
    let lastEventTime = Date.now();
    let channel: any = null;

    try {
      channel = supabase
        .channel(`owner-queue-${salon.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bookings",
            filter: `salon_id=eq.${salon.id}`,
          },
          async (payload: any) => {
            lastEventTime = Date.now();
            console.log("QUEUE_REALTIME_EVENT", payload.eventType, payload.new?.id);
            // Merge intelligently instead of refetch (no flicker!)
            mergeQueueItemUpdate(payload);
          }
        )
        .subscribe((status) => {
          console.log("QUEUE_REALTIME_STATUS", status);
        });
    } catch (err) {
      console.error("QUEUE_REALTIME_SUBSCRIPTION_ERROR", err);
    }

    // Smart fallback: check every 60s if missed any items
    const interval = setInterval(async () => {
      const now = Date.now();
      if (now - lastEventTime > 60000) {
        console.log("QUEUE_FALLBACK_SYNC: No events for 60s, checking for missed updates");
        try {
          const { data } = await supabaseAny
            .from("bookings")
            .select("id")
            .eq("salon_id", salon.id)
            .order("created_at", { ascending: false })
            .limit(1);

          if (data && data.length > 0) {
            const latestId = data[0].id;
            const currentLatestId = queueItemsRef.current?.[0]?.id;

            if (latestId !== currentLatestId) {
              console.log("QUEUE_FALLBACK_DETECTED_MISSING, refreshing");
              fetchQueue(salon.id);
            }
          }
        } catch (err) {
          console.error("QUEUE_FALLBACK_ERROR", err);
        }
      }
    }, 30000);

    return () => {
      console.log("QUEUE_REALTIME_SUBSCRIPTION_CLEANUP");
      if (channel) {
        try {
          supabase.removeChannel(channel);
          console.log("QUEUE_REALTIME_CHANNEL_CLEANUP_SUCCESS");
        } catch (err) {
          console.error("QUEUE_REALTIME_CHANNEL_CLEANUP_ERROR", err);
        }
      }
      clearInterval(interval);
    };
  }, [fetchQueue, salon?.id, mergeQueueItemUpdate, supabaseAny]);

  const updateBarber = useCallback(async (queueId: string, barberId: string | null) => {
    const previous = queueItems;
    setQueueItems((prev) => prev.map((item) => (item.id === queueId ? { ...item, barber_id: barberId } : item)));

    const { error } = await supabaseAny.from("bookings").update({ stylist_id: barberId }).eq("id", queueId);
    if (error) {
      setQueueItems(previous);
      toast.error(error.message || "Failed to assign barber");
      return;
    }

    toast.success("Barber updated");
  }, [queueItems, supabaseAny]);

  const updateStatus = useCallback(async (queueId: string, status: "pending" | "waiting" | "accepted" | "in_progress" | "cancelled" | "rejected" | "completed") => {
    console.log("UPDATE_STATUS_START", queueId, status);
    const previous = queueItems;
    const now = new Date().toISOString();

    // Optimistic update
    setQueueItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id !== queueId) return item;
        return {
          ...item,
          status,
          started_at: status === "in_progress" ? now : status === "waiting" || status === "accepted" || status === "pending" ? null : item.started_at,
          completed_at: status === "completed" ? now : item.completed_at,
        };
      });
      console.log("UPDATE_STATUS_OPTIMISTIC", { total: updated.length, item: updated.find(i => i.id === queueId) });
      return updated;
    });

    const payload: Record<string, unknown> = { status };
    if (status === "in_progress") payload.started_at = now;
    if (status === "completed") payload.completed_at = now;
    if (status === "waiting" || status === "accepted" || status === "pending") payload.started_at = null;

    setActionLoading(queueId);
    const { error } = await supabaseAny.from("bookings").update(payload).eq("id", queueId);
    setActionLoading(null);

    if (error) {
      console.error("UPDATE_STATUS_ERROR", error.message);
      // Revert optimistic update on error
      setQueueItems(previous);
      toast.error(error.message || "Failed to update queue");
      return;
    }

    console.log("STATUS_UPDATE_API_SUCCESS", queueId, status);
    toast.success(`Status updated to ${status.replace("_", " ")}`);
    
    // Refetch after a slightly longer delay to ensure DB is updated
    // This prevents the optimistic update from being overwritten by stale data
    setTimeout(() => {
      console.log("REFETCH_AFTER_UPDATE_CALLING", queueId);
      if (salon?.id) {
        fetchQueue(salon.id);
      }
    }, 300);
  }, [queueItems, supabaseAny, salon?.id, fetchQueue]);

  // Reflects a status change already written to the database elsewhere (arrival OTP
  // verification) into local state immediately, so the UI doesn't sit on stale data
  // waiting for the next fetchQueue()/realtime round-trip. Performs no DB write itself.
  const markLocalStatus = useCallback((queueId: string, status: "in_progress", startedAt: string) => {
    setQueueItems((prev) => prev.map((item) => (item.id === queueId ? { ...item, status, started_at: startedAt } : item)));
  }, []);

  const startAccept = useCallback(async (queueId: string) => {
    await updateStatus(queueId, "accepted");
    clearAcceptTimer(queueId);

    // This timer only closes the "Undo" window — it must NOT promote the booking
    // to in_progress itself. Arrival is only confirmed by OTPVerifyInput verifying
    // the customer's actual arrival code; that's the sole path into in_progress.
    const expiresAt = Date.now() + ACCEPT_WINDOW_MS;
    const timer = setTimeout(() => {
      delete acceptTimersRef.current[queueId];
      setPendingAccepts((prev) => {
        const next = { ...prev };
        delete next[queueId];
        return next;
      });
    }, ACCEPT_WINDOW_MS);

    acceptTimersRef.current[queueId] = timer;
    setPendingAccepts((prev) => ({ ...prev, [queueId]: expiresAt }));
  }, [ACCEPT_WINDOW_MS, acceptTimersRef, clearAcceptTimer, updateStatus]);

  const undoAccept = useCallback(async (queueId: string) => {
    clearAcceptTimer(queueId);
    await updateStatus(queueId, "waiting");
  }, [clearAcceptTimer, updateStatus]);

  const addWalkIn = useCallback(async (payload: WalkInPayload): Promise<boolean> => {
    if (!salon) {
      toast.error("Salon not found");
      return false;
    }

    if (!payload.customerFirstName.trim() || !payload.customerLastName.trim() || !payload.phoneNumber.trim() || !payload.serviceId || !payload.barberId) {
      toast.error("Please fill all fields");
      return false;
    }

    if (payload.customerMode === "existing" && !payload.email?.trim()) {
      toast.error("Email is required for an existing Snippr customer");
      return false;
    }

    try {
      if (import.meta.env.DEV) console.log("ADD_WALK_IN_START", salon.id);

      // The old direct .from("bookings").insert(...) here wrote columns that
      // don't exist on the live bookings table (user_id, barber_id,
      // customer_first_name/last_name/phone, time_slot — those only exist on
      // the separate, unused "queue" table) and stamped customer_id with the
      // OWNER's own auth id. create_owner_walk_in_booking() is the single,
      // atomic, security-definer replacement: it verifies salon ownership,
      // validates the service/barber belong to this salon, resolves an
      // existing Snippr account by email in "existing" mode (server-side
      // only — auth.users is never queried from the client), and performs
      // the insert using only real bookings columns. p_customer_mode is
      // explicit so "guest" never triggers a lookup even if an email is
      // somehow present, and "existing" never silently falls back to a
      // guest booking on a no-match.
      const { data, error } = await supabaseAny.rpc("create_owner_walk_in_booking", {
        p_salon_id: salon.id,
        p_service_id: payload.serviceId,
        p_barber_id: payload.barberId,
        p_customer_first_name: payload.customerFirstName.trim(),
        p_customer_last_name: payload.customerLastName.trim(),
        p_customer_phone: payload.phoneNumber.trim(),
        p_customer_mode: payload.customerMode,
        p_customer_email: payload.customerMode === "existing" ? payload.email?.trim() : null,
      }).maybeSingle();

      if (error || !data) {
        console.error("WALK_IN_RPC_ERROR", error);
        toast.error(error?.message || "Failed to add walk-in customer");
        return false;
      }

      if (data.customer_match === "not_found") {
        // No booking was created — the RPC intentionally stops short of
        // inserting anything so the owner can't mistake this for a linked
        // booking. Modal stays open (see AddWalkInModal's handleSubmit).
        toast.error("No Snippr account found with this email. Use Guest / walk-in if this customer does not have an account.");
        return false;
      }

      if (data.customer_match === "existing") {
        toast.success("Walk-in added — linked to the customer's existing Snippr account");
      } else {
        toast.success("Walk-in added to queue");
      }

      await fetchQueue(salon.id);
      return true;
    } catch (err: any) {
      console.error("WALK_IN_ERROR", err);
      toast.error(err.message || "Failed to add walk-in");
      return false;
    }
  }, [fetchQueue, salon, supabaseAny]);

  const grouped = useMemo(() => {
    const waiting = sortedQueue.filter((item) => item.status === "waiting" || item.status === "pending");
    const inProgress = sortedQueue.filter((item) => item.status === "in_progress" || item.status === "accepted");
    const completed = sortedQueue.filter((item) => item.status === "completed");
    const cancelled = sortedQueue.filter((item) => item.status === "cancelled" || item.status === "rejected");
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
    markLocalStatus,
  };
}

