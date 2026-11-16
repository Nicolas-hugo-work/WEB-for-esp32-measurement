/** Voltaje de la red usado para estimar la potencia aparente (decisión P15). */
export const VOLTAJE_RED = 220;
/** Si no llega nada en este tiempo, el medidor está "sin conexión" (envía cada 15 s). */
export const SEGUNDOS_EN_LINEA = 60;
/** Tarifa orientativa si el usuario no configuró la suya (Bs por kWh). */
export const TARIFA_POR_DEFECTO = 0.8;

/** Potencia aparente estimada (VA). */
export const va = (corrienteA: number) => corrienteA * VOLTAJE_RED;

/** Misma fórmula que evaluar_sobreconsumo() en la base de datos. */
export function umbralEfectivo(
  umbralCorrienteA: number | null,
  corrienteNominalA: number | null,
  margenPct: number,
): number | null {
  if (umbralCorrienteA != null) return Number(umbralCorrienteA);
  if (corrienteNominalA == null) return null;
  return Math.round(Number(corrienteNominalA) * (1 + margenPct / 100) * 1000) / 1000;
}

export type EstadoConexion = "en_linea" | "sin_conexion" | "nunca" | "desvinculado";

export function estadoConexion(
  ultimaConexion: string | null,
  activo: boolean,
  ahora: number = Date.now(),
): EstadoConexion {
  if (!activo) return "desvinculado";
  if (!ultimaConexion) return "nunca";
  return ahora - new Date(ultimaConexion).getTime() <= SEGUNDOS_EN_LINEA * 1000 ? "en_linea" : "sin_conexion";
}

/**
 * Energía aparente estimada (kWh) de un tramo agregado:
 * cada muestra es 1 segundo de corriente promedio × 220 V.
 */
export const kwh = (corrientePromA: number, muestras: number) =>
  (Number(corrientePromA) * VOLTAJE_RED * muestras) / 3600 / 1000;

export const costoBs = (kwhTotal: number, tarifa: number) => kwhTotal * tarifa;

const nf = (d: number) => new Intl.NumberFormat("es-BO", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtA = (a: number) => `${nf(a < 10 ? 2 : 1).format(a)} A`;
export const fmtVA = (a: number) => `${nf(0).format(va(a))} VA`;
/** Por debajo de 0,1 kWh se muestra en Wh para que no parezca "cero". */
export const fmtKwh = (k: number) =>
  k > 0 && k < 0.1 ? `${nf(k * 1000 < 10 ? 1 : 0).format(k * 1000)} Wh` : `${nf(k < 10 ? 2 : 1).format(k)} kWh`;
export const fmtBs = (b: number) => (b > 0 && b < 0.005 ? "< Bs 0,01" : `Bs ${nf(2).format(b)}`);
export const fmtNum = (n: number, d = 2) => nf(d).format(n);
