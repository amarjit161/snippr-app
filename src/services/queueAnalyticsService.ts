import { publicSupabase } from "@/integrations/supabase/publicClient";

export const queueAnalyticsService = {
  async aggregate(salonId: string, from: string, to: string) {
    const { data, error } = await publicSupabase.rpc("queue_analytics_aggregate", {
      p_salon_id: salonId,
      p_from: from,
      p_to: to,
    });
    if (error) throw error;
    return data || [];
  },

  async lifecycleTimeline(salonId: string, limit = 200) {
    const { data, error } = await publicSupabase
      .from("queue_lifecycle_events")
      .select("id, queue_id, event_name, from_status, to_status, actor, created_at")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },
};

export default queueAnalyticsService;
