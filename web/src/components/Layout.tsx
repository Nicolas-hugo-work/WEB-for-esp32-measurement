import { NavLink, Outlet } from "react-router";
import { useContadorNoLeidas } from "../features/alertas/api";
import { useEnLinea } from "../lib/hooks";
import { IcoCampana, IcoInicio, IcoMas, IcoMenu, IcoWifiOff } from "./Iconos";
import { cx } from "./ui";

function ItemBarra({ a, etiqueta, icono, insignia, fin }: {
  a: string; etiqueta: string; icono: React.ReactNode; insignia?: number; fin?: boolean;
}) {
  return (
    <NavLink
      to={a}
      end={fin}
      className={({ isActive }) =>
        cx(
          "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
          isActive ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400",
        )
      }
    >
      <span className="relative">
        {icono}
        {!!insignia && (
          <span
            aria-label={`${insignia} sin leer`}
            className="absolute -top-1.5 -right-2.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] leading-5 font-bold text-white"
          >
            {insignia > 99 ? "99+" : insignia}
          </span>
        )}
      </span>
      {etiqueta}
    </NavLink>
  );
}

export function Layout() {
  const enLinea = useEnLinea();
  const { data: noLeidas } = useContadorNoLeidas();
  return (
    <div className="pb-barra">
      {!enLinea && (
        <div role="status" className="safe-top sticky top-0 z-30 flex items-center justify-center gap-2 bg-slate-800 px-4 py-2 text-xs font-medium text-white">
          <IcoWifiOff className="size-4" /> Sin internet: mostrando los últimos datos
        </div>
      )}
      <main className="safe-top mx-auto max-w-2xl px-4 pt-4">
        <Outlet />
      </main>
      <nav
        aria-label="Navegación principal"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
      >
        <div className="mx-auto flex max-w-2xl">
          <ItemBarra a="/" fin etiqueta="Inicio" icono={<IcoInicio className="size-6" />} />
          <ItemBarra a="/alertas" etiqueta="Alertas" icono={<IcoCampana className="size-6" />} insignia={noLeidas} />
          <ItemBarra a="/agregar" etiqueta="Agregar" icono={<IcoMas className="size-6" />} />
          <ItemBarra a="/mas" etiqueta="Más" icono={<IcoMenu className="size-6" />} />
        </div>
      </nav>
    </div>
  );
}
