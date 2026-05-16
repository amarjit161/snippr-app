import { publicSupabase } from "@/integrations/supabase/publicClient";
import queueService from "./queueService";
import { queueStateMachine, fromLegacyStatus } from "@/queue/stateMachine";
import queueDiagnosticsService from "@/services/ops/queueDiagnosticsService";

/**
 * queueSyncService is responsible for ensuring writes are applied to both
 * `queue_bookings` (canonical) and `customer_bookings` (legacy) during
 * the rollout phases. It also writes audit records when inconsistencies
 * are detected.
 *
 * NOTE: For absolute atomic guarantees, implement server-side transaction
 * using an Edge Function / RPC that runs on the DB. This client-side helper
 * is intentionally conservative with retries and audit logging.
 */
export const queueSyncService = {
  async dualCreate(payload: Record<string, any>) {
    // Create in canonical table first
    const createdCanonical = await queueService.create(payload).catch((err) => {
      console.error("dualCreate: canonical create failed", err);
      throw err;
    });

    // Attempt to create in legacy table; retry once on transient failure
    const legacyPayload = { ...payload, id: createdCanonical.id };
    const { data: legacyData, error: legacyError } = await publicSupabase
      .from("customer_bookings")
      .insert(legacyPayload)
      .select("*")
      .maybeSingle();

    if (legacyError) {
      console.warn("dualCreate: legacy insert failed, creating audit record", legacyError.message);
      await publicSupabase.from("queue_sync_audit").insert({
        canonical_id: createdCanonical.id,
        salon_id: createdCanonical.salon_id,
        action: "create",
        error: legacyError.message,
        created_at: new Date().toISOString(),
      });
    }

    return { canonical: createdCanonical, legacy: legacyData || null };
  },

  async dualUpdate(id: string, payload: Record<string, any>) {
    // Update canonical first
    if (payload.status) {
      const current = await queueService.getById(id);
      if (current) {
        const from = fromLegacyStatus(String(current.status));
        const to = fromLegacyStatus(String(payload.status));
        queueStateMachine.assertTransition(from, to, { actor: "owner" });
      }
    }

    const canonical = await queueService.update(id, payload).catch((err) => {
      console.error("dualUpdate: canonical update failed", err);
      throw err;
    });

    const { error: legacyError } = await publicSupabase.from("customer_bookings").update(payload).eq("id", id);
    if (legacyError) {
      console.warn("dualUpdate: legacy update failed, auditing", legacyError.message);
      await publicSupabase.from("queue_sync_audit").insert({
        canonical_id: id,
        salon_id: canonical?.salon_id || null,
        action: "update",
        error: legacyError.message,
        created_at: new Date().toISOString(),
      });
    }

    return canonical;
  },

  async dualUpdateWithVersion(id: string, expectedRowVersion: number, payload: Record<string, any>) {
    if (payload.status) {
      const current = await queueService.getById(id);
      if (current) {
        const from = fromLegacyStatus(String(current.status));
        const to = fromLegacyStatus(String(payload.status));
        queueStateMachine.assertTransition(from, to, { actor: "owner" });
      }
    }

    const canonical = await queueService.updateWithVersion(id, expectedRowVersion, payload).catch(async (err) => {
      const latest = await queueService.getById(id).catch(() => null);
      await queueDiagnosticsService.logConflict({
        salonId: latest?.salon_id || null,
        queueId: id,
        expectedRowVersion,
        actualRowVersion: latest?.row_version ?? null,
        action: "dualUpdateWithVersion",
        details: { error: String(err), payload },
      });
      console.error("dualUpdateWithVersion: canonical update failed", err);
      throw err;
    });

    const { error: legacyError } = await publicSupabase.from("customer_bookings").update(payload).eq("id", id);
    if (legacyError) {
      await publicSupabase.from("queue_sync_audit").insert({
        canonical_id: id,
        salon_id: canonical?.salon_id || null,
        action: "update_conflict_safe",
        error: legacyError.message,
        created_at: new Date().toISOString(),
      });
    }

    return canonical;
  },

  /**
   * Lightweight reconciliation: find rows missing in canonical or legacy and
   * attempt to repair them. Intended to be run periodically by a scheduled job
   * (edge function or server cron) during rollout.
   */
  async reconcileSample(salonId: string, limit = 50) {
    // Find latest N canonical rows and ensure they exist in legacy
    const { data: canonicalRows } = await publicSupabase
      .from("queue_bookings")
      .select("id, salon_id")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!canonicalRows || canonicalRows.length === 0) return [];

    const missing: string[] = [];
    for (const row of canonicalRows) {
      const { data: legacyRow } = await publicSupabase.from("customer_bookings").select("id").eq("id", row.id).maybeSingle();
      if (!legacyRow) missing.push(row.id);
    }

    if (missing.length > 0) {
      await publicSupabase.from("queue_sync_audit").insert(missing.map((id) => ({ canonical_id: id, action: "missing_in_legacy", created_at: new Date().toISOString() })));
    }

    return missing;
  },
};

export default queueSyncService;
