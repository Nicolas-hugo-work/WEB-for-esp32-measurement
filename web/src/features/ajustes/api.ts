import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { talVez } from "../../lib/errores";
import { TARIFA_POR_DEFECTO } from "../../lib/electrica";

/** Tarifa eléctrica del usuario (Bs/kWh). Si nunca la configuró, se usa la orientativa. */
export function useTarifa() {
  return useQuery({
    queryKey: ["tarifa"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const fila = talVez(await supabase.from("ajustes_usuario").select("tarifa_bs_kwh").maybeSingle());
      return { tarifa: fila ? Number(fila.tarifa_bs_kwh) : TARIFA_POR_DEFECTO, configurada: Boolean(fila) };
    },
  });
}

export function useGuardarTarifa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id_usuario: string; tarifa: number }) => {
      const r = await supabase
        .from("ajustes_usuario")
        .upsert(
          { id_usuario: v.id_usuario, tarifa_bs_kwh: v.tarifa, actualizado_en: new Date().toISOString() },
          { onConflict: "id_usuario" },
        );
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tarifa"] }),
  });
}
