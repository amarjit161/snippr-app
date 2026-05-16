import { publicSupabase } from "@/integrations/supabase/publicClient";

export const operationalAlertService = {
  async raise(input: {
    salonId?: string | null;
    alertType: string;
    severity: "info" | "warning" | "critical";
    details?: Record<string, unknown>;
    dedupeKey?: string | null;
    groupKey?: string | null;
    cooldownSeconds?: number;
  }) {
    const { data, error } = await publicSupabase.rpc("raise_operational_alert", {
      p_salon_id: input.salonId || null,
      p_alert_type: input.alertType,
      p_severity: input.severity,
      p_details: input.details || {},
      p_dedupe_key: input.dedupeKey || null,
      p_group_key: input.groupKey || null,
      p_cooldown_seconds: input.cooldownSeconds ?? 60,
    });
    if (error) throw error;
    return data;
  },

  async recent(salonId: string, limit = 100) {
    const { data, error } = await publicSupabase
      .from("operational_alerts")
      .select("id,alert_type,severity,status,occurrence_count,group_key,last_seen_at,cooldown_until,details")
      .eq("salon_id", salonId)
      .order("last_seen_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async acknowledge(alertId: string) {
    const { error } = await publicSupabase
      .from("operational_alerts")
      .update({ acknowledged_at: new Date().toISOString(), status: "acknowledged" })
      .eq("id", alertId);
    if (error) throw error;
  },
};

export default operationalAlertService;
