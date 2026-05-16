import { publicSupabase } from "@/integrations/supabase/publicClient";

export const queueResilienceService = {
  async createSnapshot(salonId: string) {
    const { data, error } = await publicSupabase.rpc("create_queue_snapshot", { p_salon_id: salonId });
    if (error) throw error;
    return data;
  },

  async restoreFromSnapshot(salonId: string, snapshotVersion: number, replayToken: string) {
    const { data, error } = await publicSupabase.rpc("restore_queue_from_snapshot", {
      p_salon_id: salonId,
      p_snapshot_version: snapshotVersion,
      p_replay_token: replayToken,
    });
    if (error) throw error;
    return data;
  },

  async latestSnapshot(salonId: string) {
    const { data, error } = await publicSupabase
      .from("queue_recovery_snapshots")
      .select("id,salon_id,snapshot_version,source_event_seq,created_at")
      .eq("salon_id", salonId)
      .order("snapshot_version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};

export default queueResilienceService;
