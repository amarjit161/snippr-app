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
}

const createSupabaseClient = () => {
  const client = createClient<Database>(supabaseUrl, supabaseKey, {
    db: {
      schema: "public",
    },
    auth: {
      storage: window.localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: async (url, options) => {
        const start = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout
        
        try {
          const res = await fetch(url, { ...options, signal: controller.signal });
          const end = performance.now();
          if (end - start > 5000) {
            console.warn(`🐢 SLOW_FETCH [${Math.round(end - start)}ms]:`, url);
          }
          return res;
        } catch (error: any) {
          const end = performance.now();
          console.error(`🌐 SUPABASE_FETCH_ERROR [${Math.round(end - start)}ms]:`, { url, error });
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }
  });
  
  console.log("🔧 Supabase Client Created:", {
    url: supabaseUrl,
    hasKey: !!supabaseKey,
    keyLength: supabaseKey?.length,
  });
  
  return client;
};

export const supabase = (() => {
  if (typeof window === "undefined") {
    return createSupabaseClient();
  }

  if (!window.__SNIPPR_SUPABASE__) {
    window.__SNIPPR_SUPABASE__ = createSupabaseClient();
  }

  return window.__SNIPPR_SUPABASE__;
})();