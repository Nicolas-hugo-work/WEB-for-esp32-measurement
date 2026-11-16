import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../lib/supabase";
import { sinError } from "../../lib/errores";

export async function cargarCatalogo() {
  return sinError(
    await supabase
      .from("catalogo_aparatos")
      .select("id_catalogo, id_usuario, es_global, tipo, marca, modelo, potencia_nominal_w, voltaje_nominal_v, corriente_nominal_a")
      .order("tipo"),
  );
}
export type Aparato = Awaited<ReturnType<typeof cargarCatalogo>>[number];

export const describirAparato = (a: Pick<Aparato, "tipo" | "marca" | "modelo">) =>
  [a.tipo, a.marca && a.marca !== "Generica" ? a.marca : null, a.modelo && a.modelo !== "Estandar" ? a.modelo : null]
    .filter(Boolean)
    .join(" · ");

export function useCatalogo() {
  return useQuery({ queryKey: ["catalogo"], queryFn: cargarCatalogo, staleTime: 60_000 });
}

export function useEsAdmin() {
  return useQuery({
    queryKey: ["esAdmin"],
    staleTime: 5 * 60_000,
    queryFn: async () => Boolean(sinError(await supabase.rpc("es_admin"))),
  });
}

/** Mismos límites que los CHECK de la tabla. */
export const esquemaAparato = z.object({
  tipo: z.string().trim().min(1, "Escribe el tipo de aparato").max(60),
  marca: z.string().trim().max(60).optional(),
  modelo: z.string().trim().max(60).optional(),
  potencia_nominal_w: z.coerce.number({ message: "Escribe un número" }).positive("Debe ser mayor que 0").max(9_999_999),
  voltaje_nominal_v: z.coerce.number({ message: "Escribe un número" }).positive("Debe ser mayor que 0").max(9999),
});
export type DatosAparato = z.infer<typeof esquemaAparato>;

export function useGuardarAparato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id_catalogo?: number; global: boolean; id_usuario: string; datos: DatosAparato }) => {
      const fila = {
        ...v.datos,
        marca: v.datos.marca || null,
        modelo: v.datos.modelo || null,
      };
      if (v.id_catalogo) {
        const r = await supabase.from("catalogo_aparatos").update(fila).eq("id_catalogo", v.id_catalogo).select("id_catalogo");
        if (r.error) throw r.error;
        if (!r.data.length) throw { code: "42501" };
        return r.data[0].id_catalogo;
      }
      const r = await supabase
        .from("catalogo_aparatos")
        .insert({ ...fila, id_usuario: v.global ? null : v.id_usuario })
        .select("id_catalogo")
        .single();
      if (r.error) throw r.error;
      return r.data.id_catalogo;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogo"] });
      qc.invalidateQueries({ queryKey: ["medidores"] });
    },
  });
}

export function useBorrarAparato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.from("catalogo_aparatos").delete().eq("id_catalogo", id).select("id_catalogo");
      if (r.error) throw r.error;
      if (!r.data.length) throw { code: "42501" };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalogo"] }),
  });
}

/** Cuántos de mis medidores usan cada aparato del catálogo. */
export function useUsoCatalogo() {
  return useQuery({
    queryKey: ["usoCatalogo"],
    queryFn: async () => {
      const filas = sinError(await supabase.from("aparatos_instalados").select("id_catalogo"));
      const m = new Map<number, number>();
      for (const f of filas) m.set(f.id_catalogo, (m.get(f.id_catalogo) ?? 0) + 1);
      return m;
    },
  });
}
