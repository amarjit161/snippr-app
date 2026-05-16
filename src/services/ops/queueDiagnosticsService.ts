import { publicSupabase } from "@/integrations/supabase/publicClient";

export const queueDiagnosticsService = {
  async logConflict(input: {
    salonId?: string | null;
    queueId?: string | null;
    expectedRowVersion?: number | null;
    actualRowVersion?: number | null;
    action: string;
    details?: Record<string, unknown>;
  }) {
    const { error } = await publicSupabase.from("queue_conflict_diagnostics").insert({
      salon_id: input.salonId || null,
      queue_id: input.queueId || null,
      expected_row_version: input.expectedRowVersion ?? null,
      actual_row_version: input.actualRowVersion ?? null,
      action: input.action,
      details: input.details || {},
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.warn("queueDiagnosticsService.logConflict", error.message);
    }
  },

  async recentConflicts(salonId: string, limit = 200) {
    const { data, error } = await publicSupabase
      .from("queue_conflict_diagnostics")
      .select("*")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async replayHistory(salonId: string, limit = 200) {
    const { data, error } = await publicSupabase
      .from("queue_replay_events")
      .select("id,event_seq,event_type,replay_token,replayed_at,created_at")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};

export default queueDiagnosticsService;
