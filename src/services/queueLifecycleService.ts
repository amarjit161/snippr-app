import { publicSupabase } from "@/integrations/supabase/publicClient";
import type { QueueLifecycleEvent } from "@/queue/events";

export const queueLifecycleService = {
  async log(event: QueueLifecycleEvent) {
    const { error } = await publicSupabase.from("queue_lifecycle_events").insert({
      queue_id: event.queueId,
      salon_id: event.salonId || null,
      event_name: event.name,
      from_status: event.fromStatus || null,
      to_status: event.toStatus || null,
      actor: (event.payload?.actor as string | undefined) || null,
      payload: event.payload || {},
      created_at: event.occurredAt,
    });
    if (error) {
      console.warn("queueLifecycleService.log", error.message);
    }
  },
};

export default queueLifecycleService;
