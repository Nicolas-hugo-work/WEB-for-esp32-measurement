import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Link } from "react-router";
import { RutaProtegida } from "./auth/RutaProtegida";
import { Ingresar, Recuperar, Registro, Restablecer } from "./auth/PaginasCuenta";
import { Layout } from "./components/Layout";
import { Cargando } from "./components/Estados";
import { Panel } from "./features/medidores/Panel";
import { CentroAlertas } from "./features/alertas/CentroAlertas";
import { Asistente } from "./features/vinculacion/Asistente";
import { Mas } from "./features/ajustes/Mas";
import { Ajustes } from "./features/ajustes/Ajustes";
import { Catalogo } from "./features/catalogo/Catalogo";
import { Ubicaciones } from "./features/ubicaciones/Ubicaciones";
import { ConfigAlertas } from "./features/alertas/ConfigAlertas";

// El detalle carga uPlot: se baja solo cuando se abre.
const Detalle = lazy(() => import("./features/medidores/Detalle"));
const conCarga = (n: ReactNode) => <Suspense fallback={<Cargando filas={2} alto="h-48" />}>{n}</Suspense>;

function NoEncontrado() {
  return (
    <div className="py-16 text-center">
      <p className="text-lg font-semibold">Esta página no existe</p>
      <Link to="/" className="mt-4 inline-block font-medium text-amber-700 underline dark:text-amber-400">
        Ir al inicio
      </Link>
    </div>
  );
}

export const router = createBrowserRouter([
  { path: "/ingresar", element: <Ingresar /> },
  { path: "/registro", element: <Registro /> },
  { path: "/recuperar", element: <Recuperar /> },
  { path: "/restablecer", element: <Restablecer /> },
  {
    element: <RutaProtegida />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Panel /> },
          { path: "agregar", element: <Asistente /> },
          { path: "medidor/:id", element: conCarga(<Detalle />) },
          { path: "medidor/:id/alertas", element: <ConfigAlertas /> },
          { path: "alertas", element: <CentroAlertas /> },
          { path: "mas", element: <Mas /> },
          { path: "catalogo", element: <Catalogo /> },
          { path: "ubicaciones", element: <Ubicaciones /> },
          { path: "ajustes", element: <Ajustes /> },
          { path: "*", element: <NoEncontrado /> },
        ],
      },
    ],
  },
]);
