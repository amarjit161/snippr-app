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
      metric_window_start,
      metric_window_end,
      events_total = 0,
      delayed_events = 0,
      deduped_events = 0,
      reconnect_count = 0,
      conflict_count = 0,
      avg_latency_ms = 0,
      p95_latency_ms = 0,
      queue_backlog = 0,
      shed_events = 0,
      circuit_open_seconds = 0,
      mode = "normal",
    } = await req.json();

    if (!salon_id || !metric_window_start || !metric_window_end) {
      return new Response(JSON.stringify({ success: false, error: "missing_required_fields" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { error } = await supabase.from("realtime_metrics_aggregates").insert({
      salon_id,
      metric_window_start,
      metric_window_end,
      events_total,
      delayed_events,
      deduped_events,
      reconnect_count,
      conflict_count,
      avg_latency_ms,
      p95_latency_ms,
      queue_backlog,
      shed_events,
      circuit_open_seconds,
      mode,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    await captureEdgeError(err, { function: "realtime-metrics-collector" });
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
