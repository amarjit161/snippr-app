import { publicSupabase } from "@/integrations/supabase/publicClient";

export const realtimeDebugService = {
  async enqueueDelayedEvent(input: {
    salonId: string;
    queueId?: string | null;
    eventType: string;
    payload?: Record<string, unknown>;
    delayMs: number;
  }) {
    const availableAt = new Date(Date.now() + input.delayMs).toISOString();
    const { error } = await publicSupabase.from("delayed_queue_events").insert({
      salon_id: input.salonId,
      queue_id: input.queueId || null,
      event_type: input.eventType,
      payload: input.payload || {},
      available_at: availableAt,
      status: "pending",
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
  },

  async inspectDelayedEvents(salonId: string, limit = 200) {
    const { data, error } = await publicSupabase
      .from("delayed_queue_events")
      .select("*")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};

export default realtimeDebugService;
