import { TZDate } from "@date-fns/tz";
import { format, formatDistanceStrict } from "date-fns";
import { es } from "date-fns/locale";

/** Zona horaria de la app (decisión P3). */
export const ZONA = "America/La_Paz";

const enZona = (d: Date | string | number) => new TZDate(new Date(d).getTime(), ZONA);

export const fmtFechaHora = (d: Date | string) => format(enZona(d), "d MMM HH:mm", { locale: es });
export const fmtHora = (d: Date | string) => format(enZona(d), "HH:mm", { locale: es });
export const fmtDia = (d: Date | string) => format(enZona(d), "EEE d MMM", { locale: es });

export function haceCuanto(d: Date | string, ahora = Date.now()): string {
  const ms = ahora - new Date(d).getTime();
  if (ms < 45_000) return "hace instantes";
  return formatDistanceStrict(new Date(d), ahora, { locale: es, addSuffix: true });
}

/** 'yyyy-MM-dd' del día en La Paz. */
export const claveDia = (d: Date | string | number) => format(enZona(d), "yyyy-MM-dd");

/** Medianoche (La Paz) del día de `d`, como Date. */
export function inicioDia(d: Date | string | number): Date {
  const z = enZona(d);
  return new Date(new TZDate(z.getFullYear(), z.getMonth(), z.getDate(), ZONA).getTime());
}

export interface TramoHora {
  hora: string; // inicio de la hora (ISO)
  corriente_prom: number;
  corriente_max: number;
  corriente_min: number;
  muestras: number;
}

export interface Dia {
  dia: string; // yyyy-MM-dd (La Paz)
  inicio: Date;
  prom: number; // ponderado por muestras
  max: number;
  min: number;
  muestras: number;
  kwh: number;
}

/** Agrupa tramos horarios por día de La Paz (promedio ponderado por muestras). */
export function agruparPorDia(tramos: TramoHora[], kwhDe: (prom: number, muestras: number) => number): Dia[] {
  const mapa = new Map<string, Dia & { suma: number }>();
  for (const t of tramos) {
    const k = claveDia(t.hora);
    const prom = Number(t.corriente_prom), m = Number(t.muestras);
    let d = mapa.get(k);
    if (!d) {
      d = { dia: k, inicio: inicioDia(t.hora), prom: 0, max: -Infinity, min: Infinity, muestras: 0, kwh: 0, suma: 0 };
      mapa.set(k, d);
    }
    d.suma += prom * m;
    d.muestras += m;
    d.max = Math.max(d.max, Number(t.corriente_max));
    d.min = Math.min(d.min, Number(t.corriente_min));
    d.kwh += kwhDe(prom, m);
  }
  return [...mapa.values()]
    .map(({ suma, ...d }) => ({ ...d, prom: d.muestras ? suma / d.muestras : 0 }))
    .sort((a, b) => a.dia.localeCompare(b.dia));
}
