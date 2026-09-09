// Build-time sitemap generator.
//
// Runs as a "postbuild" step (see package.json) so it executes after `vite build`
// has produced ./dist, then writes a real dist/sitemap.xml containing only
// genuinely public URLs: "/", "/salons", and "/salon/<id>" for every real salon
// row readable via the public anon Supabase client (the same client/view
// Salons.tsx and SalonPage.tsx already use for anonymous-safe reads).
//
// Never fails the production build: any Supabase/env issue is logged and the
// script falls back to writing just the static URLs rather than aborting the deploy.

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

const SITE_URL = "https://www.snippr.in";
const DIST_DIR = path.resolve(rootDir, "dist");
const OUT_PATH = path.join(DIST_DIR, "sitemap.xml");

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

  // Anon/public credentials only — same as publicSupabase in the app. Never the
  // service-role key, which must never be embedded in a client-side build anyway.
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

function buildSitemapXml(salonIds) {
  const staticPaths = ["/", "/salons"];
  const urls = [
    ...staticPaths.map((p) => `${SITE_URL}${p}`),
    ...salonIds.map((id) => `${SITE_URL}/salon/${encodeURIComponent(id)}`),
  ];

  const body = urls
    .map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function main() {
  const salonIds = await fetchRealSalonIds();
  const xml = buildSitemapXml(salonIds);

  if (!existsSync(DIST_DIR)) {
    mkdirSync(DIST_DIR, { recursive: true });
  }

  writeFileSync(OUT_PATH, xml, "utf-8");
  console.log(`[sitemap] Wrote ${OUT_PATH} — 2 static URL(s) + ${salonIds.length} salon URL(s).`);
}

main().catch((err) => {
  console.error("[sitemap] Sitemap generation failed — continuing build without failing the deploy.", err);
  process.exit(0);
});
