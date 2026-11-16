/** 'ABCD2345' → 'ABCD-2345' */
export function formatearCodigo(codigo: string): string {
  const c = codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/** Segundos que faltan para que venza (nunca negativo). */
export const segundosRestantes = (venceEn: string, ahora = Date.now()) =>
  Math.max(0, Math.floor((new Date(venceEn).getTime() - ahora) / 1000));

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
