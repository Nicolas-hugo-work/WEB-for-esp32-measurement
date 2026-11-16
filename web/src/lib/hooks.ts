import { useEffect, useState, useSyncExternalStore } from "react";

/** Fecha actual que se actualiza cada `ms` (para "hace X" y cuentas regresivas). */
export function useAhora(ms = 5_000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return ahora;
}

function suscribirRed(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export const useEnLinea = () => useSyncExternalStore(suscribirRed, () => navigator.onLine, () => true);
