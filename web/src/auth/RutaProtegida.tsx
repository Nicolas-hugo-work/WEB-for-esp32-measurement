import { Navigate, Outlet, useLocation } from "react-router";
import { Spinner } from "../components/ui";
import { useAuth } from "./contexto";

/** Solo mejora la experiencia: la seguridad real la pone RLS en la base de datos. */
export function RutaProtegida() {
  const { sesion, cargando } = useAuth();
  const ubicacion = useLocation();
  if (cargando) {
    return (
      <div className="grid min-h-dvh place-items-center text-amber-500" aria-label="Cargando">
        <Spinner className="size-8" />
      </div>
    );
  }
  if (!sesion) return <Navigate to="/ingresar" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />;
  return <Outlet />;
}
