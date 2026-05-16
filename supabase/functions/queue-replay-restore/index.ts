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
    const { salon_id, snapshot_version, replay_token } = await req.json();
    if (!salon_id || !snapshot_version || !replay_token) {
      return new Response(JSON.stringify({ success: false, error: "missing_required_fields" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { data, error } = await supabase.rpc("restore_queue_from_snapshot", {
      p_salon_id: salon_id,
      p_snapshot_version: snapshot_version,
      p_replay_token: replay_token,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, restored_events: data }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    await captureEdgeError(err, { function: "queue-replay-restore" });
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
