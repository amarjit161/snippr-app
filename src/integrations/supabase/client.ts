// This file was modified to use the correct Vercel environment variables
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

declare global {
  interface Window {
    __SNIPPR_SUPABASE__?: ReturnType<typeof createClient<Database>>;
  }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

if (!hasSupabaseEnv) {
  console.error(
    "Supabase env missing. Set VITE_SUPABASE_URL and one of: VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY, VITE_SUPABASE_PUBLISHABLE_KEY, or VITE_SUPABASE_ANON_KEY."
  );
}

const supabaseUrl = SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = SUPABASE_PUBLISHABLE_KEY || "missing-supabase-key";

if (typeof window !== "undefined") {
  console.log(import.meta.env.VITE_SUPABASE_URL);
  console.info("Supabase project URL:", supabaseUrl);
  if (window.__SNIPPR_SUPABASE__) {
    delete window.__SNIPPR_SUPABASE__;
  }
}

const createSupabaseClient = () =>
  createClient<Database>(supabaseUrl, supabaseKey, {
  db: {
    schema: "public",
  },
  auth: {
    storage: window.localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

export const supabase = typeof window !== "undefined"
  ? (window.__SNIPPR_SUPABASE__ = createSupabaseClient())
  : createSupabaseClient();