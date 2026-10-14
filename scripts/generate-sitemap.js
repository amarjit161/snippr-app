// Build-time sitemap + robots generator.
//
// Runs as a "postbuild" step (see package.json) after `vite build` has produced
// ./dist. Writes one sitemap and one robots file per host; vercel.json serves
// /sitemap.xml and /robots.txt from the right pair based on the request host:
//
//   dist/sitemap-www.xml, dist/robots-www.txt   → www.snippr.in (and any other host)
//   dist/sitemap-app.xml, dist/robots-app.txt   → app.snippr.in
//
// Domain split is driven by VITE_APP_ORIGIN, exactly like the client
// (src/lib/domains.ts):
//   - unset: single-origin mode (today's behaviour). The www sitemap lists the
//     marketing pages AND the public salon pages on www.snippr.in.
//   - set (e.g. https://app.snippr.in): salon discovery (/salons, /salon/<id>)
//     moves to the app host's sitemap; www lists only marketing pages.
//
// Salon IDs come from the public anon Supabase client (same view Salons.tsx and
// SalonPage.tsx read anonymously). Never the service-role key.
//
// Never fails the production build: any Supabase/env issue is logged and the
// script falls back to static URLs rather than aborting the deploy.

import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Local dev/build: real values live in .env.local (gitignored). In Vercel's build
// environment this file won't exist, and process.env is already populated from
// the project's configured environment variables — dotenv.config() is a no-op
// when the file is missing, so this is safe in both cases.
loadDotenv({ path: path.resolve(rootDir, ".env.local") });

const originOf = (value) => {
  try {
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
};

const MARKETING_ORIGIN = originOf(process.env.VITE_MARKETING_ORIGIN) || "https://www.snippr.in";
const APP_ORIGIN_RAW = originOf(process.env.VITE_APP_ORIGIN);
const APP_ORIGIN = APP_ORIGIN_RAW && APP_ORIGIN_RAW !== MARKETING_ORIGIN ? APP_ORIGIN_RAW : null;
const DIST_DIR = path.resolve(rootDir, "dist");

// Keep in sync with MARKETING_PATHS in src/lib/domains.ts.
const MARKETING_PATHS = ["/", "/how-it-works", "/careers", "/support", "/privacy"];

// Signed-in customer/owner areas, auth screens and the booking checkout. They're
// behind login anyway; this just keeps crawlers from spending time on them.
const PRIVATE_PATHS = [
  "/admin", "/auth", "/login", "/register", "/complete-profile", "/profile-completion",
  "/forgot-password", "/reset-password", "/verify", "/verify-email",
  "/bookings", "/booking/", "/my-profile", "/favorites", "/notifications",
  "/owner-", "/onboarding", "/register-salon", "/dashboard", "/queue", "/services",
  "/team", "/salon-profile", "/settings", "/edit-salon", "/calendar", "/customers",
  "/analytics", "/reviews",
];

// Same fallback chain as src/integrations/supabase/publicClient.ts, so this
// script picks up whichever key name is actually configured.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (c) => (
    { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]
  ));
}

async function fetchRealSalonIds() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[sitemap] Supabase URL/anon key not found in env — sitemap will only contain static routes.");
    return [];
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.from("salon_with_stats").select("id");

  if (error) {
    console.error("[sitemap] Failed to fetch salons — sitemap will only contain static routes.", error.message);
    return [];
  }

  return (data || []).map((row) => row.id).filter(Boolean);
}

function buildSitemapXml(urls) {
  const body = urls
    .map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function buildRobotsTxt(origin, disallow) {
  const rules = disallow.map((p) => `Disallow: ${p}`).join("\n");
  return `User-agent: *\nAllow: /\n${rules}\n\nSitemap: ${origin}/sitemap.xml\n`;
}

function write(name, contents) {
  writeFileSync(path.join(DIST_DIR, name), contents, "utf-8");
}

async function main() {
  const salonIds = await fetchRealSalonIds();
  const discoveryOrigin = APP_ORIGIN || MARKETING_ORIGIN;
  const discoveryUrls = [
    `${discoveryOrigin}/salons`,
    ...salonIds.map((id) => `${discoveryOrigin}/salon/${encodeURIComponent(id)}`),
  ];
  const marketingUrls = MARKETING_PATHS.map((p) => `${MARKETING_ORIGIN}${p}`);

  if (!existsSync(DIST_DIR)) mkdirSync(DIST_DIR, { recursive: true });

  write("sitemap-www.xml", buildSitemapXml(APP_ORIGIN ? marketingUrls : [...marketingUrls, ...discoveryUrls]));
  write("robots-www.txt", buildRobotsTxt(MARKETING_ORIGIN, PRIVATE_PATHS));

  // Only served for requests to the app host (see vercel.json).
  write("sitemap-app.xml", buildSitemapXml(APP_ORIGIN ? discoveryUrls : []));
  write("robots-app.txt", buildRobotsTxt(APP_ORIGIN || MARKETING_ORIGIN, PRIVATE_PATHS));

  console.log(
    `[sitemap] ${APP_ORIGIN ? `split mode (app: ${APP_ORIGIN})` : "single-origin mode"} — ` +
    `${marketingUrls.length} marketing URL(s), ${discoveryUrls.length} discovery URL(s) (${salonIds.length} salons).`,
  );
}

main().catch((err) => {
  console.error("[sitemap] Sitemap generation failed — continuing build without failing the deploy.", err);
  process.exit(0);
});
