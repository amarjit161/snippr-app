import { publicSupabase } from "@/integrations/supabase/publicClient";

export const operatorNotificationService = {
  async notify(input: {
    salonId?: string | null;
    alertId?: string | null;
    message: string;
    severity?: "info" | "warning" | "critical";
    channel?: "in_app" | "email" | "sms";
  }) {
    const { error } = await publicSupabase.from("operator_notifications").insert({
      salon_id: input.salonId || null,
      alert_id: input.alertId || null,
      channel: input.channel || "in_app",
      message: input.message,
      severity: input.severity || "warning",
      status: "pending",
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
  },

  async recent(salonId: string, limit = 100) {
    const { data, error } = await publicSupabase
      .from("operator_notifications")
      .select("id,channel,message,severity,status,delivered_at,created_at")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};

export default operatorNotificationService;
