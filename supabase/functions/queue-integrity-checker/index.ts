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
    const { salon_id } = await req.json();
    if (!salon_id) {
      return new Response(JSON.stringify({ success: false, error: "missing_salon_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: issueCount, error } = await supabase.rpc("detect_queue_corruption", { p_salon_id: salon_id });
    if (error) throw error;

    if (Number(issueCount || 0) > 0) {
      await supabase.rpc("raise_operational_alert", {
        p_salon_id: salon_id,
        p_alert_type: "QUEUE_CORRUPTION",
        p_severity: "critical",
        p_details: { issue_count: issueCount },
        p_dedupe_key: `QUEUE_CORRUPTION:${salon_id}`,
        p_group_key: `INTEGRITY:${salon_id}`,
        p_cooldown_seconds: 120,
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true, issue_count: issueCount || 0 }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    await captureEdgeError(err, { function: "queue-integrity-checker" });
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
