import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const QR_SECRET = Deno.env.get("QR_SIGNING_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function sha256Hex(input: string) {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const arr = Array.from(new Uint8Array(hash));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Rate limit check: key could be ip:queueId
async function allowAttempt(key: string, limit = 6, windowSeconds = 900) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000).toISOString();
  // Try to select existing
  const { data: rows } = await supabase.from("verification_rate_limits").select("id,count,expires_at").eq("key", key).limit(1).maybeSingle();
  if (!rows) {
    await supabase.from("verification_rate_limits").insert({ key, count: 1, expires_at: expiresAt });
    return true;
  }
  if (new Date(rows.expires_at) < now) {
    // reset
    await supabase.from("verification_rate_limits").update({ count: 1, expires_at: expiresAt }).eq("id", rows.id);
    return true;
  }
  if (rows.count >= limit) return false;
  await supabase.from("verification_rate_limits").update({ count: rows.count + 1 }).eq("id", rows.id);
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { queue_id, code } = await req.json();
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rateKey = `${ip}:${queue_id}`;

    const allowed = await allowAttempt(rateKey, 6, 15 * 60);
    if (!allowed) {
      return new Response(JSON.stringify({ success: false, error: "rate_limited" }), { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { data } = await supabase.from("queue_bookings").select("id, verification_code_hash, verification_expires_at, verification_attempt_count, salon_id").eq("id", queue_id).maybeSingle();
    if (!data) return new Response(JSON.stringify({ success: false, error: "not_found" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });

    // Check expiry
    if (data.verification_expires_at && new Date(data.verification_expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, error: "expired" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const codeHash = await sha256Hex(`snippr_verification:${code}`);
    if (codeHash === data.verification_code_hash) {
      // mark verified atomically
      const { error: updErr } = await supabase.from("queue_bookings").update({ verification_verified: true, verification_attempt_count: data.verification_attempt_count + 1 }).eq("id", queue_id);
      if (updErr) {
        console.error("verify-queue.update.error", updErr.message);
        return new Response(JSON.stringify({ success: false, error: "update_failed" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
      // Optionally insert an audit row
      await supabase.from("queue_sync_audit").insert({ canonical_id: queue_id, salon_id: data.salon_id, action: 'verification_success', created_at: new Date().toISOString() }).catch(() => {});
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // increment attempts
    await supabase.from("queue_bookings").update({ verification_attempt_count: data.verification_attempt_count + 1 }).eq("id", queue_id).catch(() => {});
    return new Response(JSON.stringify({ success: false, error: "invalid_code" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    console.error("verify-queue.failed", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
