import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { env } from "./env";

// Solo la publishable key: la seguridad la da RLS.
export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export type Tablas = Database["public"]["Tables"];
