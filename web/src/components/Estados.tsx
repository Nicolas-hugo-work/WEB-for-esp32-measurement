import type { ReactNode } from "react";
import { mensajeError } from "../lib/errores";
import { Boton, cx } from "./ui";
import { IcoAviso } from "./Iconos";

export function EstadoVacio({ titulo, texto, accion }: { titulo: string; texto?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
      <p className="text-base font-semibold">{titulo}</p>
      {texto && <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">{texto}</p>}
      {accion}
    </div>
  );
}

export function EstadoError({ error, onReintentar }: { error: unknown; onReintentar?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl bg-red-50 px-6 py-8 text-center dark:bg-red-950/40">
      <IcoAviso className="size-8 text-red-600 dark:text-red-400" />
      <p className="text-sm text-red-800 dark:text-red-300">{mensajeError(error, "No pudimos cargar los datos.")}</p>
      {onReintentar && (
        <Boton variante="secundario" onClick={onReintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800", className)} />;
}

export function Cargando({ filas = 3, alto = "h-28" }: { filas?: number; alto?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <Esqueleto key={i} className={alto} />
      ))}
    </div>
  );
}
