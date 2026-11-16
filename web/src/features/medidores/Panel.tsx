import { Link } from "react-router";
import { Insignia, Tarjeta, claseBoton, cx } from "../../components/ui";
import { Cargando, EstadoError, EstadoVacio } from "../../components/Estados";
import { IcoAviso, IcoCampana, IcoFlecha } from "../../components/Iconos";
import { estadoConexion, fmtA, fmtVA, SEGUNDOS_EN_LINEA } from "../../lib/electrica";
import { haceCuanto } from "../../lib/fechas";
import { fallaActiva, infoFalla } from "../../lib/fallas";
import { useAhora } from "../../lib/hooks";
import { EstadoMedidor } from "./Estado";
import {
  nombreMedidor,
  useFallasRecientes,
  useMedidores,
  useNoLeidasPorMedidor,
  useUltimasLecturas,
  type Lectura,
  type Medidor,
} from "./api";

export function Panel() {
  const medidores = useMedidores();
  const ids = medidores.data?.map((m) => m.id_medidor) ?? [];
  const lecturas = useUltimasLecturas(ids);
  const fallas = useFallasRecientes();
  const noLeidas = useNoLeidasPorMedidor();
  const ahora = useAhora(5_000);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Mis medidores</h1>
        {!!medidores.data?.length && (
          <Link to="/agregar" className={claseBoton("secundario", "min-h-9 px-3")}>
            + Agregar
          </Link>
        )}
      </div>

      {medidores.isPending ? (
        <Cargando />
      ) : medidores.isError ? (
        <EstadoError error={medidores.error} onReintentar={() => medidores.refetch()} />
      ) : medidores.data.length === 0 ? (
        <EstadoVacio
          titulo="Aún no tienes medidores"
          texto="Conecta tu primer ESP32 para ver cuánto consume tu aparato."
          accion={
            <Link to="/agregar" className={claseBoton()}>
              Agregar medidor
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {medidores.data.map((m) => (
            <li key={m.id_medidor}>
              <TarjetaMedidor
                m={m}
                lectura={lecturas.data?.get(m.id_medidor)}
                falla={fallas.data?.get(m.id_medidor)}
                noLeidas={noLeidas.data?.get(m.id_medidor) ?? 0}
                ahora={ahora}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function TarjetaMedidor({ m, lectura, falla, noLeidas, ahora }: {
  m: Medidor;
  lectura?: Lectura;
  falla?: { codigo: string; fecha_hora: string };
  noLeidas: number;
  ahora: number;
}) {
  const estado = estadoConexion(m.ultima_conexion, m.activo, ahora);
  const vieja = lectura ? ahora - new Date(lectura.fecha_hora).getTime() > SEGUNDOS_EN_LINEA * 1000 : true;
  const conFalla = fallaActiva(falla?.fecha_hora, lectura?.fecha_hora, ahora);
  const aparato = m.aparato;
  const subtitulo = [aparato?.ubicacion?.nombre, aparato?.catalogo?.tipo].filter(Boolean).join(" · ");

  return (
    <Link to={`/medidor/${m.id_medidor}`} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-amber-500">
      <Tarjeta className="transition active:scale-[0.99]">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{nombreMedidor(m)}</p>
            {subtitulo && <p className="truncate text-sm text-slate-500 dark:text-slate-400">{subtitulo}</p>}
          </div>
          <EstadoMedidor estado={estado} ultimaConexion={m.ultima_conexion} ahora={ahora} />
        </div>

        <div className={cx("mt-3 flex items-end gap-4", vieja && "opacity-50")}>
          {lectura && m.activo ? (
            <>
              <p className="text-3xl font-bold tabular-nums">{fmtA(lectura.corriente_a)}</p>
              <p className="pb-1 text-sm text-slate-500 tabular-nums dark:text-slate-400">≈ {fmtVA(lectura.corriente_a)} est.</p>
              {vieja && <p className="ml-auto pb-1 text-xs text-slate-500">{haceCuanto(lectura.fecha_hora, ahora)}</p>}
            </>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {m.activo ? "Todavía no hay lecturas" : "Genera un código nuevo para volver a usarlo"}
            </p>
          )}
          <IcoFlecha className="ml-auto size-5 self-center text-slate-400" />
        </div>

        {(conFalla || noLeidas > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {conFalla && falla && (
              <Insignia tono="rojo">
                <IcoAviso className="size-3.5" /> {infoFalla(falla.codigo).titulo}
              </Insignia>
            )}
            {noLeidas > 0 && (
              <Insignia tono="ambar">
                <IcoCampana className="size-3.5" /> {noLeidas} {noLeidas === 1 ? "alerta" : "alertas"}
              </Insignia>
            )}
          </div>
        )}
      </Tarjeta>
    </Link>
  );
}
