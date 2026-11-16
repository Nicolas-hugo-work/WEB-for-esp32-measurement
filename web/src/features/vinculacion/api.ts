import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { sinError, talVez } from "../../lib/errores";

export interface CodigoPendiente {
  codigo: string;
  vence_en: string;
  alias: string | null;
}

const CLAVE_STORAGE = "medidor:codigo-pendiente";

/** Se guarda para retomar el asistente si el celular pierde internet (portal WiFi) o se recarga. */
export const codigoGuardado = {
  leer(): CodigoPendiente | null {
    try {
      const c = JSON.parse(sessionStorage.getItem(CLAVE_STORAGE) ?? "null") as CodigoPendiente | null;
      return c && new Date(c.vence_en).getTime() > Date.now() ? c : null;
    } catch {
      return null;
    }
  },
  guardar(c: CodigoPendiente) {
    try {
      sessionStorage.setItem(CLAVE_STORAGE, JSON.stringify(c));
    } catch {
      /* modo privado: no importa */
    }
  },
  borrar() {
    try {
      sessionStorage.removeItem(CLAVE_STORAGE);
    } catch {
      /* nada */
    }
  },
};

/** Códigos míos sin usar y sin vencer (para retomarlos). */
export function useCodigosPendientes() {
  return useQuery({
    queryKey: ["codigos", "pendientes"],
    queryFn: async () =>
      sinError(
        await supabase
          .from("codigos_vinculacion")
          .select("codigo, expira_en, alias")
          .is("usado_en", null)
          .gt("expira_en", new Date().toISOString())
          .order("creado_en", { ascending: false }),
      ).map((c): CodigoPendiente => ({ codigo: c.codigo, vence_en: c.expira_en, alias: c.alias })),
  });
}

export function useGenerarCodigo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id_catalogo: number; id_ubicacion: number | null; alias: string }) => {
      const filas = sinError(
        await supabase.rpc("generar_codigo_vinculacion", {
          p_id_catalogo: v.id_catalogo,
          p_id_ubicacion: v.id_ubicacion ?? undefined,
          p_alias: v.alias.trim() || undefined,
        }),
      );
      const f = filas[0];
      if (!f) throw new Error("sin código");
      return { codigo: f.codigo_generado, vence_en: f.vence_en, alias: v.alias.trim() || null } as CodigoPendiente;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["codigos"] }),
  });
}

/** Consulta cada 3 s si el ESP32 ya canjeó el código. También al volver el foco o la red. */
export function useEstadoCodigo(codigo: string | null, vencido: boolean) {
  return useQuery({
    queryKey: ["codigos", "estado", codigo],
    enabled: Boolean(codigo),
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: (q) => (q.state.data?.usado_en || vencido ? false : 3_000),
    queryFn: async () =>
      talVez(
        await supabase
          .from("codigos_vinculacion")
          .select("usado_en, id_medidor, expira_en")
          .eq("codigo", codigo!)
          .maybeSingle(),
      ),
  });
}
