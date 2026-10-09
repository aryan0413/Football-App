"use client";

import { createClient } from "@supabase/supabase-js";

let browserClient: any = null;

export function getSupabaseBrowser(): any {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing Supabase browser environment variables.");
  }

  browserClient ??= createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return browserClient;
}
