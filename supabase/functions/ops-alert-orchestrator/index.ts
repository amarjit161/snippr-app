import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureEdgeError } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const {
      salon_id,
      alert_type,
      severity = "warning",
      details = {},
      dedupe_key = null,
      group_key = null,
      cooldown_seconds = 60,
    } = await req.json();

    if (!alert_type) {
      return new Response(JSON.stringify({ success: false, error: "missing_alert_type" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: alertId, error: alertErr } = await supabase.rpc("raise_operational_alert", {
      p_salon_id: salon_id || null,
      p_alert_type: alert_type,
      p_severity: severity,
      p_details: details,
      p_dedupe_key: dedupe_key,
      p_group_key: group_key,
      p_cooldown_seconds: Number(cooldown_seconds),
    });
    if (alertErr) throw alertErr;

    await supabase.from("operator_notifications").insert({
      salon_id: salon_id || null,
      alert_id: alertId,
      channel: "in_app",
      message: `[${String(severity).toUpperCase()}] ${alert_type}`,
      severity,
      status: "pending",
      created_at: new Date().toISOString(),
    }).catch(() => {});

    if (severity === "critical") {
      await supabase.from("operator_escalation_events").insert({
        salon_id: salon_id || null,
        alert_id: alertId,
        escalated_to: "on_call_operator",
        reason: alert_type,
        created_at: new Date().toISOString(),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true, alert_id: alertId }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    await captureEdgeError(err, { function: "ops-alert-orchestrator" });
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
