import { publicSupabase } from "@/integrations/supabase/publicClient";

export const cleanupService = {
  async cleanupStale(salonId: string, inactiveMinutes = 120) {
    // mark waiting rows older than X minutes as cancelled
    const cutoff = new Date(Date.now() - inactiveMinutes * 60 * 1000).toISOString();
    const { error } = await publicSupabase.from("queue_bookings").update({ status: "cancelled" }).lt("created_at", cutoff).eq("salon_id", salonId);
    if (error) throw error;
    return true;
  },

  async archiveOld(p_days = 30) {
    const { data, error } = await publicSupabase.rpc("archive_old_queue_bookings", { p_days });
    if (error) throw error;
    return data;
  }
};

export default cleanupService;
