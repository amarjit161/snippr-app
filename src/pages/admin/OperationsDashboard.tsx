import { useEffect, useMemo, useState } from "react";
import queueAnalyticsService from "@/services/queueAnalyticsService";
import realtimeMetricsService from "@/services/ops/realtimeMetricsService";
import queueSlaService from "@/services/ops/queueSlaService";
import queueDiagnosticsService from "@/services/ops/queueDiagnosticsService";
import realtimeProtectionService from "@/services/ops/realtimeProtectionService";
import operationalAlertService from "@/services/ops/operationalAlertService";
import runbookService from "@/services/ops/runbookService";
import recoverySuggestionService from "@/services/ops/recoverySuggestionService";
import operatorNotificationService from "@/services/ops/operatorNotificationService";
import escalationWorkflowService from "@/services/ops/escalationWorkflowService";
import maintenanceModeService from "@/services/ops/maintenanceModeService";

type Props = {
  salonId: string;
};

export default function OperationsDashboard({ salonId }: Props) {
  const [statusAgg, setStatusAgg] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [smartAlerts, setSmartAlerts] = useState<any[]>([]);
  const [runbooks, setRunbooks] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any>(null);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [health, setHealth] = useState<number>(0);

  useEffect(() => {
    if (!salonId) return;
    (async () => {
      try {
        setFallbackError(null);
        const to = new Date();
        const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);

        const [agg, win, conf, hs, als, smart, rb, ntf, esc, mm] = await Promise.all([
          queueAnalyticsService.aggregate(salonId, from.toISOString(), to.toISOString()).catch(() => []),
          realtimeMetricsService.recentWindows(salonId, 24).catch(() => []),
          queueDiagnosticsService.recentConflicts(salonId, 50).catch(() => []),
          queueSlaService.healthScore(salonId, from.toISOString(), to.toISOString()).catch(() => 0),
          realtimeProtectionService.recentAlerts(salonId, 50).catch(() => []),
          operationalAlertService.recent(salonId, 50).catch(() => []),
          runbookService.list(20).catch(() => []),
          operatorNotificationService.recent(salonId, 50).catch(() => []),
          escalationWorkflowService.recent(salonId, 50).catch(() => []),
          maintenanceModeService.get(salonId).catch(() => null),
        ]);

        setStatusAgg(agg as any[]);
        setMetrics(win as any[]);
        setConflicts(conf as any[]);
        setHealth(hs as number);
        setAlerts(als as any[]);
        setSmartAlerts(smart as any[]);
        setRunbooks(rb as any[]);
        setNotifications(ntf as any[]);
        setEscalations(esc as any[]);
        setMaintenance(mm);

        const critical = (smart as any[]).find((a) => a.severity === "critical") || (smart as any[])[0];
        if (critical) {
          const suggestion = await recoverySuggestionService.fromAlert(critical).catch(() => null);
          setSuggestions(suggestion ? [suggestion] : []);
        } else {
          setSuggestions([]);
        }
      } catch (err: any) {
        setFallbackError(err?.message || "Failed to load full operational telemetry. Showing graceful fallback data.");
      }
    })();
  }, [salonId]);

  const totals = useMemo(() => {
    return metrics.reduce(
      (acc, m) => {
        acc.events += Number(m.events_total || 0);
        acc.delayed += Number(m.delayed_events || 0);
        acc.deduped += Number(m.deduped_events || 0);
        acc.reconnects += Number(m.reconnect_count || 0);
        acc.shed += Number(m.shed_events || 0);
        acc.backlogMax = Math.max(acc.backlogMax, Number(m.queue_backlog || 0));
        acc.p95LatencyMax = Math.max(acc.p95LatencyMax, Number(m.p95_latency_ms || 0));
        return acc;
      },
      { events: 0, delayed: 0, deduped: 0, reconnects: 0, shed: 0, backlogMax: 0, p95LatencyMax: 0 }
    );
  }, [metrics]);

  const congestionScore = useMemo(() => {
    if (totals.events <= 0) return 0;
    const delayedRatio = totals.delayed / totals.events;
    const shedRatio = totals.shed / totals.events;
    const latencyFactor = Math.min(1, totals.p95LatencyMax / 20000);
    return Math.round((delayedRatio * 0.4 + shedRatio * 0.3 + latencyFactor * 0.3) * 100);
  }, [totals]);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Operations Dashboard</h2>

      {maintenance?.enabled && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <div className="font-semibold">Maintenance Mode Active</div>
          <div className="text-muted-foreground">{maintenance.reason || "Operational maintenance in progress."} Fallback mode: {maintenance.fallback_mode}</div>
        </div>
      )}

      {fallbackError && (
        <div className="rounded border border-blue-500/40 bg-blue-500/10 p-3 text-sm">
          <div className="font-semibold">Graceful Fallback UI</div>
          <div className="text-muted-foreground">{fallbackError}</div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-8 gap-3">
        <div className="rounded border p-3"><div className="text-xs">Health Score</div><div className="text-2xl font-bold">{health}</div></div>
        <div className="rounded border p-3"><div className="text-xs">Events</div><div className="text-2xl font-bold">{totals.events}</div></div>
        <div className="rounded border p-3"><div className="text-xs">Delayed</div><div className="text-2xl font-bold">{totals.delayed}</div></div>
        <div className="rounded border p-3"><div className="text-xs">Deduped</div><div className="text-2xl font-bold">{totals.deduped}</div></div>
        <div className="rounded border p-3"><div className="text-xs">Reconnects</div><div className="text-2xl font-bold">{totals.reconnects}</div></div>
        <div className="rounded border p-3"><div className="text-xs">Shed Events</div><div className="text-2xl font-bold">{totals.shed}</div></div>
        <div className="rounded border p-3"><div className="text-xs">P95 Latency</div><div className="text-2xl font-bold">{totals.p95LatencyMax}ms</div></div>
        <div className="rounded border p-3"><div className="text-xs">Congestion</div><div className="text-2xl font-bold">{congestionScore}</div></div>
      </div>

      <div className="rounded border p-3">
        <h3 className="font-semibold mb-2">Queue Status Aggregation (24h)</h3>
        <pre className="text-xs overflow-auto">{JSON.stringify(statusAgg, null, 2)}</pre>
      </div>

      <div className="rounded border p-3">
        <h3 className="font-semibold mb-2">Conflict Diagnostics</h3>
        <pre className="text-xs overflow-auto">{JSON.stringify(conflicts, null, 2)}</pre>
      </div>

      <div className="rounded border p-3">
        <h3 className="font-semibold mb-2">Realtime Alerts</h3>
        <pre className="text-xs overflow-auto">{JSON.stringify(alerts, null, 2)}</pre>
      </div>

      <div className="rounded border p-3">
        <h3 className="font-semibold mb-2">Smart Alerts (Deduped / Cooldown)</h3>
        <pre className="text-xs overflow-auto">{JSON.stringify(smartAlerts, null, 2)}</pre>
      </div>

      <div className="rounded border p-3">
        <h3 className="font-semibold mb-2">Automated Recovery Suggestions</h3>
        <pre className="text-xs overflow-auto">{JSON.stringify(suggestions, null, 2)}</pre>
      </div>

      <div className="rounded border p-3">
        <h3 className="font-semibold mb-2">Operational Runbooks</h3>
        <pre className="text-xs overflow-auto">{JSON.stringify(runbooks, null, 2)}</pre>
      </div>

      <div className="rounded border p-3">
        <h3 className="font-semibold mb-2">Operator Notifications</h3>
        <pre className="text-xs overflow-auto">{JSON.stringify(notifications, null, 2)}</pre>
      </div>

      <div className="rounded border p-3">
        <h3 className="font-semibold mb-2">Escalation Workflow Events</h3>
        <pre className="text-xs overflow-auto">{JSON.stringify(escalations, null, 2)}</pre>
      </div>
    </div>
  );
}
