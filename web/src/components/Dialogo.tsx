import { useEffect, useRef, type ReactNode } from "react";

/** Diálogo modal nativo (<dialog>): foco atrapado, Esc para cerrar y accesible. */
export function Dialogo({
  abierto,
  onCerrar,
  titulo,
  children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => e.target === ref.current && onCerrar()}
      aria-label={titulo}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-slate-100"
    >
      {abierto && (
        <div className="max-h-[85dvh] overflow-y-auto p-5">
          <h2 className="mb-4 text-lg font-bold">{titulo}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
