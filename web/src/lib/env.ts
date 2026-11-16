import { z } from "zod";

const esquema = z.object({
  VITE_SUPABASE_URL: z.string().min(1, "Falta VITE_SUPABASE_URL"),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "Falta VITE_SUPABASE_PUBLISHABLE_KEY")
    .refine((k) => !k.startsWith("sb_secret_"), "Nunca uses la secret key en la web"),
  VITE_VAPID_PUBLIC_KEY: z.string().default(""),
});

const r = esquema.safeParse(import.meta.env);
if (!r.success) {
  throw new Error("Variables de entorno inválidas: " + r.error.issues.map((i) => i.message).join(", "));
}

/** Acepta una URL absoluta o una ruta del mismo origen (proxy local "/supabase"). */
function urlAbsoluta(u: string): string {
  return u.startsWith("/") ? window.location.origin + u : u;
}

export const env = {
  supabaseUrl: urlAbsoluta(r.data.VITE_SUPABASE_URL),
  supabaseKey: r.data.VITE_SUPABASE_PUBLISHABLE_KEY,
  vapidPublica: r.data.VITE_VAPID_PUBLIC_KEY,
};
