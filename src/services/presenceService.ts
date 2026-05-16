import { publicSupabase } from "@/integrations/supabase/publicClient";

export const presenceService = {
  async touch(salonId: string, userId: string | null, connectionId: string, meta: any = {}) {
    // upsert by connection id
    const payload = { salon_id: salonId, user_id: userId, connection_id: connectionId, meta, last_seen: new Date().toISOString() };
    await publicSupabase.from("queue_presence").upsert(payload, { onConflict: "connection_id" }).catch(() => {});
  },

  async listSalon(salonId: string) {
    const { data } = await publicSupabase.from("queue_presence").select("*").eq("salon_id", salonId);
    return data || [];
  },

  async removeConnection(connectionId: string) {
    await publicSupabase.from("queue_presence").delete().eq("connection_id", connectionId).catch(() => {});
  }
};

export default presenceService;
