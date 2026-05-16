import { publicSupabase } from "@/integrations/supabase/publicClient";

export const replayDiagnosticsService = {
  async logFailure(input: {
    salonId?: string | null;
    replayToken?: string | null;
    sourceEventSeq?: number | null;
    error: string;
    details?: Record<string, unknown>;
  }) {
    await publicSupabase.from("replay_failure_diagnostics").insert({
      salon_id: input.salonId || null,
      replay_token: input.replayToken || null,
      source_event_seq: input.sourceEventSeq ?? null,
      error: input.error,
      details: input.details || {},
      created_at: new Date().toISOString(),
    }).catch(() => {});
  },

  async recent(salonId: string, limit = 100) {
    const { data, error } = await publicSupabase
      .from("replay_failure_diagnostics")
      .select("id,replay_token,source_event_seq,error,details,created_at")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};

export default replayDiagnosticsService;
