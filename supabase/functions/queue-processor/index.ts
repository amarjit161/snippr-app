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
    const body = await req.json().catch(() => ({}));
    const salonId = body?.salon_id || null;
    const archiveDays = Number(body?.archive_days || 30);

    const [timeoutRes, noShowRes, archiveRes] = await Promise.all([
      supabase.rpc("process_queue_timeouts", { p_salon_id: salonId }),
      supabase.rpc("detect_no_show", { p_salon_id: salonId }),
      supabase.rpc("archive_old_queue_bookings", { p_days: archiveDays }),
    ]);

    if (timeoutRes.error) throw timeoutRes.error;
    if (noShowRes.error) throw noShowRes.error;
    if (archiveRes.error) throw archiveRes.error;

    return new Response(
      JSON.stringify({
        success: true,
        timeouts: timeoutRes.data || [],
        noShows: noShowRes.data || [],
        archived: archiveRes.data || 0,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    await captureEdgeError(err, { function: "queue-processor" });
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
