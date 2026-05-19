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
  status: "waiting" | "accepted" | "in_progress" | "completed" | "cancelled";
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
  services?: ServiceRow | null;
  barbers?: BarberRow | null;
};

type WalkInPayload = {
  customerFirstName: string;
  customerLastName: string;
  phoneNumber: string;
  serviceId: string;
  barberId: string;
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
      .from("queue")
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
    setQueueItems((data as QueueItem[]) || []);
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
        .from("queue")
        .select("*, services (*), barbers (*), salons (*)")
        .eq("id", queueId)
        .maybeSingle();
      return data;
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
        // Add placeholder immediately
        return [{ ...newRow, services: null, barbers: null } as QueueItem, ...prev];
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
        // Update optimistically first
        return prev.map((item) => (item.id === newRow.id ? { ...item, ...newRow } as QueueItem : item));
      }

      return prev;
    });
  }, [fetchQueueItemFull]);

  useEffect(() => {
    if (!salon?.id) return;

    console.log("QUEUE_REALTIME_SUBSCRIPTION_START", salon.id);
    let lastEventTime = Date.now();

    const channel = supabase
      .channel(`owner-queue-${salon.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue",
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

    // Smart fallback: check every 60s if missed any items
    const interval = setInterval(async () => {
      const now = Date.now();
      if (now - lastEventTime > 60000) {
        console.log("QUEUE_FALLBACK_SYNC: No events for 60s, checking for missed updates");
        try {
          const { data } = await supabaseAny
            .from("queue")
            .select("id")
            .eq("salon_id", salon.id)
            .order("created_at", { ascending: false })
            .limit(1);

          if (data && data.length > 0) {
            const latestId = data[0].id;
            const currentLatestId = queueItems?.[0]?.id;

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
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchQueue, salon?.id, mergeQueueItemUpdate, queueItems, supabaseAny]);

  const updateBarber = useCallback(async (queueId: string, barberId: string | null) => {
    const previous = queueItems;
    setQueueItems((prev) => prev.map((item) => (item.id === queueId ? { ...item, barber_id: barberId } : item)));

    const { error } = await supabaseAny.from("queue").update({ barber_id: barberId }).eq("id", queueId);
    if (error) {
      setQueueItems(previous);
      toast.error(error.message || "Failed to assign barber");
      return;
    }

    toast.success("Barber updated");
  }, [queueItems, supabaseAny]);

  const updateStatus = useCallback(async (queueId: string, status: "waiting" | "accepted" | "in_progress" | "cancelled" | "rejected" | "completed") => {
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
          started_at: status === "in_progress" ? now : status === "waiting" || status === "accepted" ? null : item.started_at,
          completed_at: status === "completed" ? now : item.completed_at,
        };
      });
      console.log("UPDATE_STATUS_OPTIMISTIC", { total: updated.length, item: updated.find(i => i.id === queueId) });
      return updated;
    });

    const payload: Record<string, unknown> = { status };
    if (status === "in_progress") payload.started_at = now;
    if (status === "completed") payload.completed_at = now;
    if (status === "waiting" || status === "accepted") payload.started_at = null;

    setActionLoading(queueId);
    const { error } = await supabaseAny.from("queue").update(payload).eq("id", queueId);
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

  const startAccept = useCallback(async (queueId: string) => {
    await updateStatus(queueId, "accepted");
    clearAcceptTimer(queueId);

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
  }, [ACCEPT_WINDOW_MS, acceptTimersRef, clearAcceptTimer, updateStatus]);

  const undoAccept = useCallback(async (queueId: string) => {
    clearAcceptTimer(queueId);
    await updateStatus(queueId, "waiting");
  }, [clearAcceptTimer, updateStatus]);

  const addWalkIn = useCallback(async (payload: WalkInPayload) => {
    if (!salon) {
      toast.error("Salon not found");
      return;
    }

    if (!payload.customerFirstName.trim() || !payload.customerLastName.trim() || !payload.phoneNumber.trim() || !payload.serviceId || !payload.barberId) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      if (import.meta.env.DEV) console.log("ADD_WALK_IN_START", salon.id);

      const { data: { user: freshUser } } = await supabase.auth.getUser();
      if (!freshUser) throw new Error("Owner session expired. Please re-login.");

      const { data: positionRows } = await (supabase
        .from("queue") as any)
        .select("position")
        .eq("salon_id", salon.id)
        .order("position", { ascending: false })
        .limit(1);

      const nextPosition = ((positionRows?.[0]?.position as number | undefined) || 0) + 1;
      const createdAt = new Date().toISOString();
      const todayBookingDate = createdAt.slice(0, 10);
      const bookingTimeSlot = createdAt.slice(11, 16);
      const tempId = `temp-${Date.now()}`;

      const selectedService = services.find((service) => service.id === payload.serviceId) || null;
      const selectedBarber = barbers.find((barber) => barber.id === payload.barberId) || null;

      // Optimistic update
      const optimisticItem: QueueItem = {
        id: tempId,
        created_at: createdAt,
        status: "waiting",
        user_id: freshUser.id,
        service_id: payload.serviceId,
        barber_id: payload.barberId,
        position: nextPosition,
        started_at: null,
        completed_at: null,
        customer_first_name: payload.customerFirstName.trim(),
        customer_last_name: payload.customerLastName.trim(),
        customer_phone: payload.phoneNumber.trim(),
        booking_date: todayBookingDate,
        time_slot: bookingTimeSlot,
        services: selectedService,
        barbers: selectedBarber,
      };

      setQueueItems((prev) => [...prev, optimisticItem]);

      const { data: insertedData, error: insertError } = await (supabase.from("queue") as any)
        .insert({
          salon_id: salon.id,
          user_id: freshUser.id,
          service_id: payload.serviceId,
          barber_id: payload.barberId,
          status: "waiting",
          position: nextPosition,
          created_at: createdAt,
          customer_first_name: payload.customerFirstName.trim(),
          customer_last_name: payload.customerLastName.trim(),
          customer_phone: payload.phoneNumber.trim(),
          booking_date: todayBookingDate,
          time_slot: bookingTimeSlot,
        })
        .select("*")
        .single();

      if (insertError || !insertedData) {
        setQueueItems((prev) => prev.filter((item) => item.id !== tempId));
        toast.error(insertError?.message || "Failed to add walk-in customer");
        return;
      }

      setQueueItems((prev) =>
        prev.map((item) => (item.id === tempId ? { ...item, ...insertedData, services: selectedService, barbers: selectedBarber } : item))
      );

      toast.success("Walk-in added to queue");
      await fetchQueue(salon.id);
    } catch (err: any) {
      console.error("WALK_IN_ERROR", err);
      toast.error(err.message || "Failed to add walk-in");
    }
  }, [barbers, fetchQueue, salon, services, supabaseAny]);

  const grouped = useMemo(() => {
    const waiting = sortedQueue.filter((item) => item.status === "waiting");
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
  };
}

