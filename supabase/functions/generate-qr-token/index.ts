import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SECRET = Deno.env.get("QR_SIGNING_SECRET") || "";

async function hmacSha256Hex(key: string, msg: string) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64url(input: string) {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { queue_id, expires_in = 900 } = await req.json();
    if (!queue_id) return new Response(JSON.stringify({ success: false, error: "missing_queue_id" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const payload = { queue_id, exp: Math.floor(Date.now() / 1000) + Number(expires_in) };
    const payloadStr = JSON.stringify(payload);
    const sig = await hmacSha256Hex(SECRET, payloadStr);
    const token = `${base64url(payloadStr)}.${sig}`;

    return new Response(JSON.stringify({ success: true, token }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    console.error("generate-qr-token.failed", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
