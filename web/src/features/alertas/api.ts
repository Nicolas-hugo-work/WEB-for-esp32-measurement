import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { sinError } from "../../lib/errores";

const POR_PAGINA = 20;
const SELECT_ALERTA =
  "id_alerta, id_medidor, tipo, corriente_a, umbral_a, fecha_hora, leida, medidor:medidores_esp32(nombre, aparato:aparatos_instalados(alias))";

/** Insignia de la barra inferior. */
export function useContadorNoLeidas() {
  return useQuery({
    queryKey: ["alertas", "contador"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const r = await supabase.from("alertas").select("id_alerta", { count: "exact", head: true }).eq("leida", false);
      if (r.error) throw r.error;
      return r.count ?? 0;
    },
  });
}

export function useAlertas(soloNoLeidas: boolean, idMedidor?: number) {
  return useInfiniteQuery({
    queryKey: ["alertas", "lista", soloNoLeidas, idMedidor ?? "todas"],
    initialPageParam: 0,
    refetchInterval: 30_000,
    queryFn: async ({ pageParam }) => {
      let q = supabase.from("alertas").select(SELECT_ALERTA).order("fecha_hora", { ascending: false });
      if (soloNoLeidas) q = q.eq("leida", false);
      if (idMedidor) q = q.eq("id_medidor", idMedidor);
      return sinError(await q.range(pageParam, pageParam + POR_PAGINA - 1));
    },
    getNextPageParam: (ultima, todas) => (ultima.length === POR_PAGINA ? todas.length * POR_PAGINA : undefined),
  });
}
export type Alerta = NonNullable<ReturnType<typeof useAlertas>["data"]>["pages"][number][number];

export function nombreDeAlerta(a: Alerta) {
  return a.medidor?.aparato?.alias?.trim() || a.medidor?.nombre?.trim() || `Medidor ${a.id_medidor}`;
}

export function useMarcarLeida() {
  const qc = useQueryClient();
  return useMutation({
    /** Sin id: marca todas las mías (RLS limita a mis medidores). */
    mutationFn: async (idAlerta?: number) => {
      let q = supabase.from("alertas").update({ leida: true }).eq("leida", false);
      if (idAlerta) q = q.eq("id_alerta", idAlerta);
      const r = await q;
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alertas"] }),
  });
}
