import { publicSupabase } from "@/integrations/supabase/publicClient";

export const queueSlaService = {
  async upsertDailyMetric(input: {
    salonId: string;
    metricDate: string;
    avgWaitSeconds: number;
    p95WaitSeconds: number;
    completionRate: number;
    noShowRate: number;
    recoverySuccessRate: number;
  }) {
    const payload = {
      salon_id: input.salonId,
      metric_date: input.metricDate,
      avg_wait_seconds: input.avgWaitSeconds,
      p95_wait_seconds: input.p95WaitSeconds,
      completion_rate: input.completionRate,
      no_show_rate: input.noShowRate,
      recovery_success_rate: input.recoverySuccessRate,
    };
    const { error } = await publicSupabase.from("queue_sla_metrics").upsert(payload, { onConflict: "salon_id,metric_date" });
    if (error) throw error;
  },

  async healthScore(salonId: string, from: string, to: string) {
    const { data, error } = await publicSupabase.rpc("queue_health_score", {
      p_salon_id: salonId,
      p_from: from,
      p_to: to,
    });
    if (error) throw error;
    return Number(data || 0);
  },
};

export default queueSlaService;
