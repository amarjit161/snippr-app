import { publicSupabase } from "@/integrations/supabase/publicClient";

export const maintenanceModeService = {
  async get(salonId: string) {
    const { data, error } = await publicSupabase
      .from("maintenance_modes")
      .select("enabled,reason,fallback_mode,starts_at,ends_at,updated_at")
      .eq("salon_id", salonId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async set(input: {
    salonId: string;
    enabled: boolean;
    reason?: string;
    fallbackMode?: "read_only" | "reduced_realtime" | "offline_banner";
    startsAt?: string | null;
    endsAt?: string | null;
  }) {
    const payload = {
      salon_id: input.salonId,
      enabled: input.enabled,
      reason: input.reason || null,
      fallback_mode: input.fallbackMode || "read_only",
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await publicSupabase
      .from("maintenance_modes")
      .upsert(payload, { onConflict: "salon_id" });

    if (error) throw error;
  },
};

export default maintenanceModeService;
