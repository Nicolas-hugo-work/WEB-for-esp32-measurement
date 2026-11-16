import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variante = "primario" | "secundario" | "peligro" | "fantasma";
const VARIANTES: Record<Variante, string> = {
  primario: "bg-amber-500 text-slate-950 hover:bg-amber-400 active:bg-amber-600",
  secundario:
    "bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700",
  peligro: "bg-red-600 text-white hover:bg-red-500 active:bg-red-700",
  fantasma: "text-slate-700 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800",
};

/** Clases de botón para usar en un <Link> (un botón dentro de un enlace no es HTML válido). */
export const claseBoton = (variante: Variante = "primario", extra?: string) =>
  cx(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
    VARIANTES[variante],
    extra,
  );

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  cargando?: boolean;
  bloque?: boolean;
}

export const Boton = forwardRef<HTMLButtonElement, BotonProps>(function Boton(
  { variante = "primario", cargando, bloque, className, children, disabled, type = "button", ...p },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTES[variante],
        bloque && "w-full",
        className,
      )}
      {...p}
    >
      {cargando && <Spinner />}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}

const claseCampo =
  "block w-full min-h-11 rounded-xl border-0 bg-white px-3 text-base text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700";

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Entrada(
  { className, ...p },
  ref,
) {
  return <input ref={ref} className={cx(claseCampo, className)} {...p} />;
});

export const Selector = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Selector(
  { className, children, ...p },
  ref,
) {
  return (
    <select ref={ref} className={cx(claseCampo, "pr-8", className)} {...p}>
      {children}
    </select>
  );
});

export function Campo({
  etiqueta,
  ayuda,
  error,
  children,
  htmlFor,
}: {
  etiqueta: string;
  ayuda?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {etiqueta}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : (
        ayuda && <p className="text-xs text-slate-500 dark:text-slate-400">{ayuda}</p>
      )}
    </div>
  );
}

export function Tarjeta({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800",
        className,
      )}
    >
      {children}
    </div>
  );
}

type Tono = "verde" | "gris" | "rojo" | "ambar" | "azul";
const TONOS: Record<Tono, string> = {
  verde: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  gris: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  rojo: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  ambar: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300",
  azul: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
};
export function Insignia({ tono = "gris", children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", TONOS[tono])}>
      {children}
    </span>
  );
}

export function Interruptor({
  activo,
  onCambio,
  etiqueta,
  id,
  disabled,
}: {
  activo: boolean;
  onCambio: (v: boolean) => void;
  etiqueta: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={() => onCambio(!activo)}
      className={cx(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50",
        activo ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-700",
      )}
    >
      <span className={cx("inline-block size-5 rounded-full bg-white shadow transition", activo ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

export function Pestanas<T extends string>({
  opciones,
  valor,
  onCambio,
}: {
  opciones: { valor: T; etiqueta: string }[];
  valor: T;
  onCambio: (v: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
      {opciones.map((o) => (
        <button
          key={o.valor}
          role="tab"
          type="button"
          aria-selected={valor === o.valor}
          onClick={() => onCambio(o.valor)}
          className={cx(
            "min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition",
            valor === o.valor
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white"
              : "text-slate-600 dark:text-slate-400",
          )}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

/** Título de página con botón de volver opcional y acciones a la derecha. */
export function Encabezado({ titulo, volver, acciones }: { titulo: ReactNode; volver?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {volver}
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{titulo}</h1>
      {acciones}
    </div>
  );
}
