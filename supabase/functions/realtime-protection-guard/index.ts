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
      bucket_key = "realtime_events",
      cost = 1,
      context = {},
    } = await req.json();

    if (!salon_id) {
      return new Response(JSON.stringify({ success: false, error: "missing_salon_id" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { data: allowed, error } = await supabase.rpc("consume_salon_realtime_tokens", {
      p_salon_id: salon_id,
      p_bucket_key: bucket_key,
      p_cost: Number(cost),
    });

    if (error) throw error;

    if (!allowed) {
      await supabase.from("realtime_alerts").insert({
        salon_id,
        alert_type: "RATE_LIMIT_BLOCK",
        severity: "warning",
        details: { bucket_key, cost, context },
        created_at: new Date().toISOString(),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true, allowed: Boolean(allowed) }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    await captureEdgeError(err, { function: "realtime-protection-guard" });
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
