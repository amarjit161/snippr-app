import { publicSupabase } from "@/integrations/supabase/publicClient";

export const escalationWorkflowService = {
  async escalateIfNeeded(input: {
    salonId?: string | null;
    alertId?: string | null;
    severity: "info" | "warning" | "critical";
    reason: string;
  }) {
    if (input.severity !== "critical") return;

    const { data: workflows } = await publicSupabase
      .from("operator_escalation_workflows")
      .select("id,target_role,enabled")
      .eq("salon_id", input.salonId || null)
      .eq("severity", "critical")
      .eq("enabled", true);

    if (!workflows || workflows.length === 0) {
      // fallback escalation event
      await publicSupabase.from("operator_escalation_events").insert({
        salon_id: input.salonId || null,
        alert_id: input.alertId || null,
        escalated_to: "on_call_operator",
        reason: input.reason,
        created_at: new Date().toISOString(),
      }).catch(() => {});
      return;
    }

    await publicSupabase.from("operator_escalation_events").insert(
      workflows.map((wf: any) => ({
        salon_id: input.salonId || null,
        alert_id: input.alertId || null,
        workflow_id: wf.id,
        escalated_to: wf.target_role,
        reason: input.reason,
        created_at: new Date().toISOString(),
      }))
    ).catch(() => {});
  },

  async recent(salonId: string, limit = 100) {
    const { data, error } = await publicSupabase
      .from("operator_escalation_events")
      .select("id,alert_id,escalated_to,reason,created_at")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};

export default escalationWorkflowService;
