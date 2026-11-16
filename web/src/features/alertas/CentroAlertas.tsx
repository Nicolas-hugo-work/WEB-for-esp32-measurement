import { useState } from "react";
import { useNavigate } from "react-router";
import { Boton, Encabezado, Pestanas, cx } from "../../components/ui";
import { Cargando, EstadoError, EstadoVacio } from "../../components/Estados";
import { useAviso } from "../../components/avisos";
import { fmtA } from "../../lib/electrica";
import { fmtFechaHora } from "../../lib/fechas";
import { mensajeError } from "../../lib/errores";
import { nombreDeAlerta, useAlertas, useContadorNoLeidas, useMarcarLeida, type Alerta } from "./api";

export function CentroAlertas() {
  const [filtro, setFiltro] = useState<"todas" | "noLeidas">("todas");
  const alertas = useAlertas(filtro === "noLeidas");
  const contador = useContadorNoLeidas();
  const marcar = useMarcarLeida();
  const navegar = useNavigate();
  const avisar = useAviso();
  const lista = alertas.data?.pages.flat() ?? [];

  function abrir(a: Alerta) {
    if (!a.leida) marcar.mutate(a.id_alerta);
    navegar(`/medidor/${a.id_medidor}`);
  }

  return (
    <>
      <Encabezado
        titulo="Alertas"
        acciones={
          !!contador.data && (
            <Boton
              variante="fantasma"
              className="min-h-9 px-2 text-xs"
              cargando={marcar.isPending}
              onClick={() =>
                marcar.mutate(undefined, {
                  onSuccess: () => avisar("Todas marcadas como leídas"),
                  onError: (e) => avisar(mensajeError(e), "error"),
                })
              }
            >
              Marcar todas como leídas
            </Boton>
          )
        }
      />
      <div className="mb-4">
        <Pestanas
          valor={filtro}
          onCambio={setFiltro}
          opciones={[
            { valor: "todas", etiqueta: "Todas" },
            { valor: "noLeidas", etiqueta: `No leídas${contador.data ? ` (${contador.data})` : ""}` },
          ]}
        />
      </div>

      {alertas.isPending ? (
        <Cargando filas={4} alto="h-16" />
      ) : alertas.isError ? (
        <EstadoError error={alertas.error} onReintentar={() => alertas.refetch()} />
      ) : lista.length === 0 ? (
        <EstadoVacio
          titulo={filtro === "noLeidas" ? "No tienes alertas sin leer" : "Sin alertas"}
          texto="Te avisaremos si algún aparato consume más de lo normal."
        />
      ) : (
        <>
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800">
            {lista.map((a) => (
              <li key={a.id_alerta}>
                <button
                  onClick={() => abrir(a)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <span
                    aria-label={a.leida ? "Leída" : "Sin leer"}
                    className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", a.leida ? "bg-transparent" : "bg-amber-500")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cx("block truncate", !a.leida && "font-semibold")}>{nombreDeAlerta(a)}</span>
                    <span className="block text-sm text-slate-500 tabular-nums dark:text-slate-400">
                      Consumió {fmtA(Number(a.corriente_a))} (límite {fmtA(Number(a.umbral_a))})
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{fmtFechaHora(a.fecha_hora)}</span>
                </button>
              </li>
            ))}
          </ul>
          {alertas.hasNextPage && (
            <div className="mt-4 text-center">
              <Boton variante="secundario" cargando={alertas.isFetchingNextPage} onClick={() => alertas.fetchNextPage()}>
                Cargar más
              </Boton>
            </div>
          )}
        </>
      )}
    </>
  );
}
