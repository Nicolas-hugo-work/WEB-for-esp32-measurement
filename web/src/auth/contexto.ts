import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";

export interface EstadoAuth {
  sesion: Session | null;
  cargando: boolean;
  /** true si se entró con el enlace de "recuperar contraseña". */
  recuperando: boolean;
}

export const CtxAuth = createContext<EstadoAuth>({ sesion: null, cargando: true, recuperando: false });
export const useAuth = () => useContext(CtxAuth);

/** Usuario actual (solo dentro de rutas protegidas). */
export function useUsuario() {
  const { sesion } = useAuth();
  if (!sesion) throw new Error("useUsuario fuera de una ruta protegida");
  return sesion.user;
}
