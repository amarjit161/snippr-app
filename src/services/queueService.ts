import { publicSupabase } from "@/integrations/supabase/publicClient";

type QueueRow = any;

/**
 * queueService: thin abstraction over the `queue_bookings` table.
 * - Keeps reads/writes in a single place so we can migrate consumers safely.
 */
export const queueService = {
  async listBySalon(salonId: string) {
    const { data, error } = await publicSupabase
      .from<QueueRow>("queue_bookings")
      .select(`*, services (*), barbers (*), salons (*)`)
      .eq("salon_id", salonId)
      .order("position", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("queueService.listBySalon error", error.message);
      throw error;
    }
    return data || [];
  },

  async getById(id: string) {
    const { data, error } = await publicSupabase
      .from<QueueRow>("queue_bookings")
      .select("*, services (*), barbers (*), salons (*)")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("queueService.getById error", error.message);
      throw error;
    }
    return data || null;
  },

  async create(payload: Partial<QueueRow>) {
    const { data, error } = await publicSupabase
      .from<QueueRow>("queue_bookings")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("queueService.create error", error.message);
      throw error;
    }
    return data;
  },

  async update(id: string, payload: Partial<QueueRow>) {
    const { data, error } = await publicSupabase
      .from<QueueRow>("queue_bookings")
      .update(payload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("queueService.update error", error.message);
      throw error;
    }
    return data || null;
  },

  async updateWithVersion(id: string, expectedRowVersion: number, payload: Partial<QueueRow>) {
    const safePayload = {
      ...payload,
      row_version: expectedRowVersion + 1,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await publicSupabase
      .from<QueueRow>("queue_bookings")
      .update(safePayload)
      .eq("id", id)
      .eq("row_version", expectedRowVersion)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("queueService.updateWithVersion error", error.message);
      throw error;
    }
    if (!data) {
      throw new Error("Version conflict. Queue item was changed by another operator.");
    }

    return data;
  },

  subscribeToSalon(salonId: string, handler: (payload: any) => void) {
    const channel = publicSupabase
      .channel(`realtime-queue-${salonId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_bookings", filter: `salon_id=eq.${salonId}` },
        (payload) => handler(payload)
      )
      .subscribe((status) => {
        // status may be 'SUBSCRIBED' / 'TIMED_OUT' etc.
        console.debug("queueService.subscribe status", status);
      });

    return channel;
  },

  removeChannel(channel: any) {
    try {
      publicSupabase.removeChannel(channel);
    } catch (err) {
      console.warn("queueService.removeChannel", err);
    }
  },
};

export default queueService;
