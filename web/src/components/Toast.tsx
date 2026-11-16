import { useCallback, useState, type ReactNode } from "react";
import { CtxAviso, type TipoAviso } from "./avisos";

interface Aviso {
  id: number;
  texto: string;
  tipo: TipoAviso;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, tipo: TipoAviso = "ok") => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <CtxAviso.Provider value={avisar}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4"
      >
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.tipo === "error" ? "alert" : "status"}
            className={
              "pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg " +
              (a.tipo === "error" ? "bg-red-600 text-white" : "bg-slate-900 text-white dark:bg-white dark:text-slate-900")
            }
          >
            {a.texto}
          </div>
        ))}
      </div>
    </CtxAviso.Provider>
  );
}
