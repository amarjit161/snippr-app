import { publicSupabase } from "@/integrations/supabase/publicClient";
import operationalAlertService from "@/services/ops/operationalAlertService";
import operatorNotificationService from "@/services/ops/operatorNotificationService";
import escalationWorkflowService from "@/services/ops/escalationWorkflowService";

type CircuitState = {
  openUntil: number;
  reason?: string;
};

const circuitBySalon = new Map<string, CircuitState>();

export const realtimeProtectionService = {
  isCircuitOpen(salonId: string) {
    const st = circuitBySalon.get(salonId);
    if (!st) return false;
    return Date.now() < st.openUntil;
  },

  openCircuit(salonId: string, ms: number, reason: string) {
    circuitBySalon.set(salonId, { openUntil: Date.now() + ms, reason });
  },

  closeCircuit(salonId: string) {
    circuitBySalon.delete(salonId);
  },

  async getThresholds(salonId: string) {
    const { data } = await publicSupabase
      .from("realtime_alert_thresholds")
      .select("max_reconnects_per_min,max_delayed_events_per_min,max_backlog,max_latency_ms,max_conflicts_per_hour")
      .eq("salon_id", salonId)
      .maybeSingle();

    return data || {
      max_reconnects_per_min: 12,
      max_delayed_events_per_min: 30,
      max_backlog: 500,
      max_latency_ms: 15000,
      max_conflicts_per_hour: 25,
    };
  },

  async raiseAlert(input: {
    salonId?: string | null;
    alertType: string;
    severity?: "info" | "warning" | "critical";
    details?: Record<string, unknown>;
    dedupeKey?: string | null;
    groupKey?: string | null;
    cooldownSeconds?: number;
  }) {
    await publicSupabase.from("realtime_alerts").insert({
      salon_id: input.salonId || null,
      alert_type: input.alertType,
      severity: input.severity || "warning",
      details: input.details || {},
      created_at: new Date().toISOString(),
    }).catch(() => {});

    // Alert intelligence layer: dedupe + cooldown + grouping
    const alertId = await operationalAlertService.raise({
      salonId: input.salonId || null,
      alertType: input.alertType,
      severity: input.severity || "warning",
      details: input.details || {},
      dedupeKey: input.dedupeKey || input.alertType,
      groupKey: input.groupKey || null,
      cooldownSeconds: input.cooldownSeconds ?? 60,
    }).catch(() => null);

    // Operator notification + escalation workflow hooks
    await operatorNotificationService.notify({
      salonId: input.salonId || null,
      alertId: alertId || null,
      message: `[${String(input.severity || "warning").toUpperCase()}] ${input.alertType}`,
      severity: input.severity || "warning",
      channel: "in_app",
    }).catch(() => {});

    await escalationWorkflowService.escalateIfNeeded({
      salonId: input.salonId || null,
      alertId: alertId || null,
      severity: input.severity || "warning",
      reason: input.alertType,
    }).catch(() => {});
  },

  async consumeSalonTokens(salonId: string, bucketKey: string, cost = 1) {
    const { data, error } = await publicSupabase.rpc("consume_salon_realtime_tokens", {
      p_salon_id: salonId,
      p_bucket_key: bucketKey,
      p_cost: cost,
    });
    if (error) {
      console.warn("consumeSalonTokens", error.message);
      return true;
    }
    return Boolean(data);
  },

  async recentAlerts(salonId: string, limit = 100) {
    const { data, error } = await publicSupabase
      .from("realtime_alerts")
      .select("id,alert_type,severity,details,created_at,acknowledged_at")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};

export default realtimeProtectionService;
