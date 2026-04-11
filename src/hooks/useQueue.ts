import { useCallback, useEffect, useMemo, useState } from "react";
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
  status: "waiting" | "in_progress" | "completed" | "cancelled";
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
  booking_time?: string | null;
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

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [salon, setSalon] = useState<SalonRow | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [barbers, setBarbers] = useState<BarberRow[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);

  const sortedQueue = useMemo(() => {
    return [...queueItems].sort((a, b) => {
      const aPos = a.position ?? Number.MAX_SAFE_INTEGER;
      const bPos = b.position ?? Number.MAX_SAFE_INTEGER;
      if (aPos !== bPos) return aPos - bPos;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [queueItems]);

  const fetchQueue = useCallback(async (salonId: string) => {
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
      toast.error(error.message || "Failed to load queue");
      return;
    }

    setQueueItems((data as QueueItem[]) || []);
  }, [supabaseAny]);

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

  useEffect(() => {
    if (!salon?.id) return;

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
        async () => {
          await fetchQueue(salon.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQueue, salon?.id]);

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

  const updateStatus = useCallback(async (queueId: string, status: "in_progress" | "cancelled" | "completed") => {
    const previous = queueItems;
    const now = new Date().toISOString();

    setQueueItems((prev) =>
      prev.map((item) => {
        if (item.id !== queueId) return item;
        return {
          ...item,
          status,
          started_at: status === "in_progress" ? now : item.started_at,
          completed_at: status === "completed" ? now : item.completed_at,
        };
      })
    );

    const payload: Record<string, unknown> = { status };
    if (status === "in_progress") payload.started_at = now;
    if (status === "completed") payload.completed_at = now;

    setActionLoading(queueId);
    const { error } = await supabaseAny.from("queue").update(payload).eq("id", queueId);
    setActionLoading(null);

    if (error) {
      setQueueItems(previous);
      toast.error(error.message || "Failed to update queue");
      return;
    }

    toast.success(`Status updated to ${status.replace("_", " ")}`);
  }, [queueItems, supabaseAny]);

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
      console.log("ADD_WALK_IN_START", salon.id);

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
    const inProgress = sortedQueue.filter((item) => item.status === "in_progress");
    const completed = sortedQueue.filter((item) => item.status === "completed");
    const cancelled = sortedQueue.filter((item) => item.status === "cancelled");
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
    fetchQueue,
    addWalkIn,
    updateStatus,
    updateBarber,
  };
}
