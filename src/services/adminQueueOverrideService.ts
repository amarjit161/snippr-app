import queueSyncService from "@/services/queueSyncService";
import queueLifecycleService from "@/services/queueLifecycleService";
import { queueStateMachine, fromLegacyStatus } from "@/queue/stateMachine";
import { publicSupabase } from "@/integrations/supabase/publicClient";

export const adminQueueOverrideService = {
  async forceStatus(queueItem: any, nextLegacyStatus: string, adminId: string, reason: string) {
    const from = fromLegacyStatus(queueItem.status);
    const to = fromLegacyStatus(nextLegacyStatus);

    // Admin override still validates machine; force true permits emergency path.
    queueStateMachine.assertTransition(from, to, { actor: "admin", force: true });

    const updated = await queueSyncService.dualUpdate(queueItem.id, { status: nextLegacyStatus });

    await queueLifecycleService.log({
      name: "ADMIN_OVERRIDE",
      queueId: queueItem.id,
      salonId: queueItem.salon_id || null,
      fromStatus: String(from),
      toStatus: String(to),
      payload: { actor: "admin", adminId, reason },
      occurredAt: new Date().toISOString(),
    });

    await publicSupabase.from("admin_activity_logs").insert({
      admin_id: adminId,
      action: "queue_force_override",
      details: { queueId: queueItem.id, from: String(from), to: String(to), reason },
      created_at: new Date().toISOString(),
    }).catch(() => {});

    return updated;
  },
};

export default adminQueueOverrideService;
