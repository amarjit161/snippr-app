import QRCode from "qrcode";

// Same production domain the sitemap build script points to (scripts/generate-sitemap.js).
// Kept as a literal here (not env-derived) so the QR always encodes the real public
// booking domain regardless of which host (localhost, staging) the owner is viewing from.
const SITE_URL = "https://www.snippr.in";

export function buildQuickBookingUrl(quickBookingCode: string): string {
  return `${SITE_URL}/q/${quickBookingCode}`;
}

// Print-quality PNG: high error correction (QR stays scannable even if part of a
// printed copy is smudged/creased), a full quiet zone, and pure black-on-white for
// maximum contrast — no embedded logo or decoration that could interfere with scanning.
export async function generateQuickBookingQrDataUrl(url: string, sizePx: number): Promise<string> {
  return QRCode.toDataURL(url, {
    width: sizePx,
    margin: 4,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

export function sanitizeForFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "salon";
}
