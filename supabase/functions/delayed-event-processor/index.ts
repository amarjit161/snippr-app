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
    const { salon_id = null, limit = 100 } = await req.json().catch(() => ({}));

    const { data, error } = await supabase.rpc("process_delayed_queue_events", {
      p_salon_id: salon_id,
      p_limit: Number(limit),
    });
    if (error) throw error;

    // Replay processed delayed events into lifecycle stream for observability
    if (Array.isArray(data) && data.length > 0) {
      await supabase.from("queue_lifecycle_events").insert(
        data.map((ev: any) => ({
          queue_id: ev.queue_id,
          salon_id: ev.salon_id,
          event_name: "DELAYED_EVENT_PROCESSED",
          payload: { event_type: ev.event_type, payload: ev.payload },
          created_at: new Date().toISOString(),
        }))
      ).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true, processed: data || [] }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    await captureEdgeError(err, { function: "delayed-event-processor" });
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
