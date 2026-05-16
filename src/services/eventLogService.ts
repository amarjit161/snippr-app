import { publicSupabase } from "@/integrations/supabase/publicClient";

export const eventLogService = {
  async tailByRow(rowId: string, sinceSeq = 0, limit = 200) {
    const { data, error } = await publicSupabase
      .from("queue_event_logs")
      .select("seq_id, event_type, row_id, payload, created_at")
      .gte("seq_id", sinceSeq)
      .eq("row_id", rowId)
      .order("seq_id", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async recentForSalon(salonId: string, limit = 500) {
    const { data, error } = await publicSupabase
      .from("queue_lifecycle_events")
      .select("id, queue_id, event_name, from_status, to_status, created_at")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },
};

export default eventLogService;
