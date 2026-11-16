import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { CtxAuth } from "./contexto";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);
  const [recuperando, setRecuperando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargando(false);
    });
    // No llamar a otros métodos de supabase dentro de este callback (puede bloquearse).
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      setSesion(s);
      setCargando(false);
      if (evento === "PASSWORD_RECOVERY") setRecuperando(true);
      if (evento === "SIGNED_OUT") setRecuperando(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <CtxAuth.Provider value={{ sesion, cargando, recuperando }}>{children}</CtxAuth.Provider>;
}
