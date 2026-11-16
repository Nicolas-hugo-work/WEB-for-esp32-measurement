import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { sinError } from "../../lib/errores";

export function useUbicaciones() {
  return useQuery({
    queryKey: ["ubicaciones"],
    staleTime: 60_000,
    queryFn: async () =>
      sinError(await supabase.from("ubicaciones").select("id_ubicacion, nombre").order("nombre")),
  });
}

export function useCrearUbicacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { nombre: string; id_usuario: string }) =>
      sinError(
        await supabase
          .from("ubicaciones")
          .insert({ nombre: v.nombre.trim(), id_usuario: v.id_usuario })
          .select("id_ubicacion, nombre")
          .single(),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ubicaciones"] }),
  });
}

export function useRenombrarUbicacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id_ubicacion: number; nombre: string }) => {
      const r = await supabase
        .from("ubicaciones")
        .update({ nombre: v.nombre.trim() })
        .eq("id_ubicacion", v.id_ubicacion)
        .select("id_ubicacion");
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ubicaciones"] });
      qc.invalidateQueries({ queryKey: ["medidores"] });
    },
  });
}

export function useBorrarUbicacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.from("ubicaciones").delete().eq("id_ubicacion", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ubicaciones"] });
      qc.invalidateQueries({ queryKey: ["medidores"] });
    },
  });
}
