import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { salon_id, limit = 100 } = await req.json();
    if (!salon_id) return new Response(JSON.stringify({ success: false, error: "missing_salon_id" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const { data: missing, error } = await supabase.rpc("queue_sync_reconcile", { p_salon_id: salon_id, p_limit: limit });
    if (error) {
      console.error("reconcile-sample.rpc.error", error.message);
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Insert audit rows for missing ids
    if (Array.isArray(missing) && missing.length > 0) {
      await supabase.from("queue_sync_audit").insert(missing.map((r: any) => ({ canonical_id: r.missing_id, action: 'missing_in_legacy', created_at: new Date().toISOString() }))).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true, missing: missing || [] }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    console.error("reconcile-sample.failed", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
