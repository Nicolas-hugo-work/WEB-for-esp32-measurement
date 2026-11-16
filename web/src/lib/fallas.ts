export type CodigoFalla = "REVISAR_DIVISOR" | "FUERA_RANGO_ADC" | "SIN_CALIBRAR_CERO" | "CERO_FALLIDO";

export interface InfoFalla {
  titulo: string;
  explicacion: string;
  queHacer: string;
}

// El hardware no tiene botones (decisión P10): la recalibración ocurre sola al encender
// el ESP32 si no tiene un cero válido guardado.
export const FALLAS: Record<CodigoFalla, InfoFalla> = {
  REVISAR_DIVISOR: {
    titulo: "Revisar divisor",
    explicacion:
      "El circuito que centra la señal del sensor no da el voltaje esperado (debería estar entre 1,40 y 1,90 V). Mientras tanto no se puede medir.",
    queHacer: "Revisa las dos resistencias del divisor, el capacitor y que los cables del sensor estén bien conectados.",
  },
  FUERA_RANGO_ADC: {
    titulo: "Señal fuera de rango",
    explicacion:
      "La señal del sensor se sale de lo que el ESP32 puede leer. Puede ser una corriente más grande de la que soporta el sensor o un cable flojo.",
    queHacer: "Revisa la conexión del sensor SCT013 y que el aparato no supere la capacidad del sensor (50 A).",
  },
  SIN_CALIBRAR_CERO: {
    titulo: "Sin calibrar",
    explicacion: "El medidor todavía no sabe cuánto es «cero» y no puede calcular la corriente.",
    queHacer:
      "Apaga el aparato, desenchufa el medidor 10 segundos y vuelve a enchufarlo. Al encender se calibra solo (deja el aparato apagado ~10 s).",
  },
  CERO_FALLIDO: {
    titulo: "Calibración fallida",
    explicacion:
      "La calibración del cero falló porque había demasiado ruido; lo más común es que el aparato estuviera encendido mientras calibraba.",
    queHacer:
      "Apaga el aparato, desenchufa el medidor 10 segundos y vuelve a enchufarlo. Si se repite, revisa el cableado del sensor.",
  },
};

export const infoFalla = (codigo: string): InfoFalla =>
  FALLAS[codigo as CodigoFalla] ?? { titulo: codigo, explicacion: "Falla desconocida.", queHacer: "Contacta a soporte." };

/** La falla se repite cada 5 min mientras dura: se considera activa si es de hace menos de 11 min. */
export const MINUTOS_FALLA_ACTIVA = 11;

/**
 * Heurística (no hay señal de "falla resuelta"): activa si es reciente y no llegó
 * ninguna lectura después (en falla el ESP32 no manda lecturas).
 */
export function fallaActiva(
  fechaFalla: string | null | undefined,
  fechaUltimaLectura: string | null | undefined,
  ahora = Date.now(),
): boolean {
  if (!fechaFalla) return false;
  const tf = new Date(fechaFalla).getTime();
  if (ahora - tf > MINUTOS_FALLA_ACTIVA * 60_000) return false;
  return !fechaUltimaLectura || tf > new Date(fechaUltimaLectura).getTime();
}
