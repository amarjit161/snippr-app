// This file was modified to use the correct Vercel environment variables
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

console.log("VITE_SUPABASE_URL:", SUPABASE_URL);
console.log("VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY:", SUPABASE_PUBLISHABLE_KEY);

if (!SUPABASE_URL) throw new Error("VITE_SUPABASE_URL is missing!");
if (!SUPABASE_PUBLISHABLE_KEY) throw new Error("VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY is missing!");

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: window.localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});