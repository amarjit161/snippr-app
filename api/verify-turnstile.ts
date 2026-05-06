import "dotenv/config";
import { verifyTurnstileWithCloudflare } from "../src/lib/turnstile-server.js";

const readJsonBody = async (req: any): Promise<any> => {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }

  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => {
      raw += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : null);
      } catch {
        resolve(null);
      }
    });
  });
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: false, message: "Method not allowed" }));
    return;
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("❌ TURNSTILE_SECRET_KEY is missing in process.env");
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: false, message: "Captcha verification unavailable" }));
    return;
  }

  const body = await readJsonBody(req);
  const token = typeof body?.token === "string" ? body.token : "";

  if (!token) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: false, message: "Invalid or expired captcha" }));
    return;
  }

  try {
    console.log("🔐 TURNSTILE_SERVER_VERIFY_START");

    const remoteIpHeader = req.headers["x-forwarded-for"];
    const remoteIp = typeof remoteIpHeader === "string" ? remoteIpHeader.split(",")[0].trim() : undefined;
    
    const result = await verifyTurnstileWithCloudflare(token, secret, remoteIp);
    console.log("🔐 TURNSTILE_SERVER_VERIFY_RESULT", result);

    if (!result.success) {
      console.error("❌ TURNSTILE_SERVER_CLOUDFLARE_FAILED", result);
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      
      const isExpiredOrInvalid = (result["error-codes"] || []).some((code) =>
        ["timeout-or-duplicate", "invalid-input-response", "missing-input-response", "timeout"].includes(code)
      );

      const message = isExpiredOrInvalid 
        ? "Invalid or expired captcha" 
        : "Captcha verification failed";
      
      res.end(JSON.stringify({
        success: false,
        message,
        "error-codes": result["error-codes"] || [],
      }));
      return;
    }

    console.log("✅ TURNSTILE_SERVER_VERIFY_SUCCESS");
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: true }));
  } catch (error) {
    console.error("❌ TURNSTILE_SERVER_VERIFY_ERROR", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: false, message: "Captcha verification failed" }));
  }
}