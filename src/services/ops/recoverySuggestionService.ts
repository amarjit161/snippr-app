import runbookService from "@/services/ops/runbookService";

const ALERT_TO_RUNBOOK: Record<string, string> = {
  RECONNECT_STORM: "RECONNECT_STORM",
  EVENT_ORDER_GAP: "QUEUE_CORRUPTION",
  QUEUE_LOAD_SHEDDING: "SLA_BREACH",
  SLA_BREACH: "SLA_BREACH",
  RATE_LIMIT_BLOCK: "RECONNECT_STORM",
};

export const recoverySuggestionService = {
  async fromAlert(alert: { alert_type?: string; severity?: string; details?: any }) {
    const runbookKey = ALERT_TO_RUNBOOK[String(alert.alert_type || "")] || "SLA_BREACH";
    const runbook = await runbookService.getByKey(runbookKey).catch(() => null);
    const hints = (runbook?.automation_hints as any)?.suggestions || [];
    const checklist = (runbook?.checklist as any) || [];

    return {
      runbookKey,
      title: runbook?.title || "Operational Guidance",
      severity: alert.severity || runbook?.severity || "warning",
      checklist,
      suggestions: hints,
      context: alert.details || {},
    };
  },
};

export default recoverySuggestionService;
