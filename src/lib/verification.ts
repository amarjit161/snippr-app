/**
 * verification.ts
 * - Generate short numeric codes for customer verification
 * - Hash codes for safe storage
 * - Verify provided code against stored hash
 *
 * Note: For production security, perform hashing & verification server-side
 * (Edge Function) to avoid exposing secret logic in the browser. This module
 * is safe to use in Edge Functions or server APIs.
 */

async function sha256Hex(input: string) {
  if (typeof window !== "undefined" && window.crypto && (window.crypto as any).subtle) {
    const enc = new TextEncoder();
    const data = enc.encode(input);
    const hash = await (window.crypto as any).subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Node fallback
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(input).digest("hex");
  } catch (err) {
    throw new Error("No crypto available for hashing");
  }
}

export function generateNumericCode(digits = 4) {
  const max = 10 ** digits;
  const val = Math.floor(Math.random() * max).toString().padStart(digits, "0");
  return val;
}

export async function hashCode(code: string, salt = "snippr_verification") {
  // Simple salted SHA256. For extra safety, use bcrypt or Argon2 server-side.
  return await sha256Hex(`${salt}:${code}`);
}

export async function verifyCode(code: string, storedHash: string, salt = "snippr_verification") {
  const h = await hashCode(code, salt);
  return h === storedHash;
}

export default { generateNumericCode, hashCode, verifyCode };
