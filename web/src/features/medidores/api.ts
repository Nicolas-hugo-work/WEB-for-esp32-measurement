import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { sinError, talVez } from "../../lib/errores";
import type { TramoHora } from "../../lib/fechas";

const SELECT_MEDIDOR =
  "id_medidor, nombre, activo, ultima_conexion, firmware_version, creado_en, aparato:aparatos_instalados(id_aparato, id_catalogo, id_ubicacion, alias, alerta_activa, umbral_corriente_a, margen_alerta_pct, segundos_sostenido, ubicacion:ubicaciones(nombre), catalogo:catalogo_aparatos(tipo, marca, modelo, potencia_nominal_w, corriente_nominal_a))";

async function cargarMedidores() {
  return sinError(await supabase.from("medidores_esp32").select(SELECT_MEDIDOR).order("creado_en"));
}
export type Medidor = Awaited<ReturnType<typeof cargarMedidores>>[number];

/** Nombre visible: alias del aparato, nombre del medidor o tipo del catálogo. */
export const nombreMedidor = (m: Medidor) =>
  m.aparato?.alias?.trim() || m.nombre?.trim() || m.aparato?.catalogo?.tipo || `Medidor ${m.id_medidor}`;

export function useMedidores() {
  return useQuery({ queryKey: ["medidores"], queryFn: cargarMedidores, refetchInterval: 15_000 });
}

export function useMedidor(id: number) {
  return useQuery({
    queryKey: ["medidores", id],
    queryFn: async () =>
      talVez(await supabase.from("medidores_esp32").select(SELECT_MEDIDOR).eq("id_medidor", id).maybeSingle()),
    refetchInterval: 15_000,
    enabled: Number.isFinite(id),
  });
}

export interface Lectura {
  fecha_hora: string;
  corriente_a: number;
}

/** Última lectura de cada medidor (vista ultima_lectura). */
export function useUltimasLecturas(ids: number[]) {
  return useQuery({
    queryKey: ["ultima", ids.join(",")],
    enabled: ids.length > 0,
    refetchInterval: 5_000,
    queryFn: async () => {
      const filas = sinError(
        await supabase.from("ultima_lectura").select("id_medidor, fecha_hora, corriente_a").in("id_medidor", ids),
      );
      const mapa = new Map<number, Lectura>();
      for (const f of filas) {
        if (f.id_medidor != null && f.fecha_hora && f.corriente_a != null) {
          mapa.set(f.id_medidor, { fecha_hora: f.fecha_hora, corriente_a: Number(f.corriente_a) });
        }
      }
      return mapa;
    },
  });
}

/** Fallas de los últimos 15 min (la más reciente por medidor). */
export function useFallasRecientes() {
  return useQuery({
    queryKey: ["fallas", "recientes"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - 15 * 60_000).toISOString();
      const filas = sinError(
        await supabase
          .from("fallas_hardware")
          .select("id_medidor, codigo, fecha_hora")
          .gte("fecha_hora", desde)
          .order("fecha_hora", { ascending: false }),
      );
      const mapa = new Map<number, { codigo: string; fecha_hora: string }>();
      for (const f of filas) if (!mapa.has(f.id_medidor)) mapa.set(f.id_medidor, f);
      return mapa;
    },
  });
}

/** Cantidad de alertas sin leer por medidor. */
export function useNoLeidasPorMedidor() {
  return useQuery({
    queryKey: ["alertas", "porMedidor"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const filas = sinError(await supabase.from("alertas").select("id_medidor").eq("leida", false).limit(1000));
      const mapa = new Map<number, number>();
      for (const f of filas) mapa.set(f.id_medidor, (mapa.get(f.id_medidor) ?? 0) + 1);
      return mapa;
    },
  });
}

// ------------------------------------------------------------------ detalle

const VENTANA_VIVO_MS = 10 * 60_000;

/** Últimos 10 min, segundo a segundo. Después de la primera carga solo pide lo nuevo. */
export function useLecturasVivo(id: number) {
  const qc = useQueryClient();
  const clave = ["vivo", id];
  return useQuery({
    queryKey: clave,
    refetchInterval: 5_000,
    queryFn: async () => {
      const previas = qc.getQueryData<Lectura[]>(clave) ?? [];
      const corte = Date.now() - VENTANA_VIVO_MS;
      const ultima = previas.at(-1)?.fecha_hora;
      let q = supabase
        .from("lecturas_energia")
        .select("fecha_hora, corriente_a")
        .eq("id_medidor", id)
        .order("fecha_hora", { ascending: true })
        .limit(1000);
      q = ultima ? q.gt("fecha_hora", ultima) : q.gte("fecha_hora", new Date(corte).toISOString());
      const nuevas = sinError(await q).map((l) => ({ fecha_hora: l.fecha_hora, corriente_a: Number(l.corriente_a) }));
      return [...previas, ...nuevas].filter((l) => new Date(l.fecha_hora).getTime() >= corte);
    },
  });
}

export interface PuntoSerie {
  t: string;
  corriente_prom: number;
  corriente_max: number;
  corriente_min: number;
  muestras: number;
}

/** Segundos por punto según el rango (el servidor agranda si hace falta: máx ~900 puntos). */
const SEG_POR_RANGO: Record<number, number> = { 1: 5, 6: 30, 24: 120, 72: 300 };

async function serie(id: number, desde: Date, hasta: Date, seg: number): Promise<PuntoSerie[]> {
  const filas = sinError(
    await supabase.rpc("lecturas_serie", {
      p_id_medidor: id,
      p_desde: desde.toISOString(),
      p_hasta: hasta.toISOString(),
      p_seg: seg,
    }),
  );
  return filas.map((f) => ({
    t: f.t,
    corriente_prom: Number(f.corriente_prom),
    corriente_max: Number(f.corriente_max),
    corriente_min: Number(f.corriente_min),
    muestras: Number(f.muestras),
  }));
}

export function useSerie(id: number, horas: number, activo: boolean) {
  return useQuery({
    queryKey: ["serie", id, horas],
    enabled: activo,
    refetchInterval: 60_000,
    queryFn: () => {
      const hasta = new Date(Date.now() + 60_000);
      return serie(id, new Date(hasta.getTime() - horas * 3_600_000), hasta, SEG_POR_RANGO[horas] ?? 60);
    },
  });
}

/**
 * Consumo por hora de los últimos `dias`: lecturas_hora (horas ya resumidas) +
 * lecturas en bruto agrupadas por hora para lo que todavía no se resumió (hora en curso).
 */
export function useConsumoHorario(id: number, dias = 30) {
  return useQuery({
    queryKey: ["consumoHorario", id, dias],
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<(TramoHora & { parcial: boolean })[]> => {
      const ahora = Date.now();
      const desde = new Date(ahora - dias * 86_400_000);
      desde.setUTCMinutes(0, 0, 0);
      const resumidas = sinError(
        await supabase
          .from("lecturas_hora")
          .select("hora, corriente_prom, corriente_max, corriente_min, muestras")
          .eq("id_medidor", id)
          .gte("hora", desde.toISOString())
          .order("hora")
          .limit(1000),
      ).map((h) => ({
        hora: h.hora,
        corriente_prom: Number(h.corriente_prom),
        corriente_max: Number(h.corriente_max),
        corriente_min: Number(h.corriente_min),
        muestras: h.muestras,
        parcial: false,
      }));
      // Las lecturas en bruto duran 3 días: lo no resumido se arma desde ahí.
      const ultimaResumida = resumidas.at(-1)?.hora;
      const minimoBruto = ahora - 3 * 86_400_000;
      const desdeBruto = new Date(
        Math.max(ultimaResumida ? new Date(ultimaResumida).getTime() + 3_600_000 : desde.getTime(), minimoBruto),
      );
      desdeBruto.setUTCMinutes(0, 0, 0);
      const horaActual = new Date(ahora);
      horaActual.setUTCMinutes(0, 0, 0);
      const brutas = (await serie(id, desdeBruto, new Date(ahora + 60_000), 3600)).map((p) => ({
        hora: p.t,
        corriente_prom: p.corriente_prom,
        corriente_max: p.corriente_max,
        corriente_min: p.corriente_min,
        muestras: p.muestras,
        parcial: new Date(p.t).getTime() >= horaActual.getTime(),
      }));
      return [...resumidas, ...brutas];
    },
  });
}

export function useFallasMedidor(id: number) {
  return useQuery({
    queryKey: ["fallas", id],
    refetchInterval: 30_000,
    queryFn: async () =>
      sinError(
        await supabase
          .from("fallas_hardware")
          .select("id_falla, codigo, bias_v, fecha_hora")
          .eq("id_medidor", id)
          .order("fecha_hora", { ascending: false })
          .limit(50),
      ),
  });
}

// --------------------------------------------------------------- mutaciones

/** Comprueba que el update/delete afectó una fila (RLS filtra en silencio). */
function exigirFila<T>(r: { data: T[] | null; error: unknown }) {
  if (r.error) throw r.error;
  if (!r.data?.length) throw { code: "42501", message: "sin filas" };
}

export function useGuardarMedidor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      id_medidor: number;
      id_aparato: number;
      nombre: string;
      id_catalogo: number;
      id_ubicacion: number | null;
    }) => {
      const nombre = v.nombre.trim() || null;
      // Un solo nombre (decisión P4): se guarda en el medidor y en el aparato.
      exigirFila(
        await supabase
          .from("aparatos_instalados")
          .update({ alias: nombre, id_catalogo: v.id_catalogo, id_ubicacion: v.id_ubicacion })
          .eq("id_aparato", v.id_aparato)
          .select("id_aparato"),
      );
      exigirFila(
        await supabase.from("medidores_esp32").update({ nombre }).eq("id_medidor", v.id_medidor).select("id_medidor"),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medidores"] }),
  });
}

export function useGuardarAlertas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      id_aparato: number;
      alerta_activa: boolean;
      umbral_corriente_a: number | null;
      margen_alerta_pct: number;
      segundos_sostenido: number;
    }) => {
      const { id_aparato, ...cambios } = v;
      exigirFila(
        await supabase.from("aparatos_instalados").update(cambios).eq("id_aparato", id_aparato).select("id_aparato"),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medidores"] }),
  });
}

export function useDesvincular() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      exigirFila(await supabase.from("medidores_esp32").update({ activo: false }).eq("id_medidor", id).select("id_medidor")),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medidores"] }),
  });
}

export function useEliminarMedidor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      exigirFila(await supabase.from("medidores_esp32").delete().eq("id_medidor", id).select("id_medidor")),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medidores"] });
      qc.invalidateQueries({ queryKey: ["alertas"] });
    },
  });
}
