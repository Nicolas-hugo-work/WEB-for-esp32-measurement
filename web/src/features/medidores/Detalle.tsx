import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Boton, Encabezado, Insignia, Pestanas, Tarjeta, claseBoton, cx } from "../../components/ui";
import { Cargando, EstadoError, EstadoVacio, Esqueleto } from "../../components/Estados";
import { IcoAtras, IcoAviso } from "../../components/Iconos";
import { costoBs, estadoConexion, fmtA, fmtBs, fmtKwh, fmtVA, kwh, umbralEfectivo } from "../../lib/electrica";
import { agruparPorDia, fmtDia, fmtFechaHora, haceCuanto, inicioDia } from "../../lib/fechas";
import { fallaActiva, infoFalla } from "../../lib/fallas";
import { useAhora } from "../../lib/hooks";
import { useTarifa } from "../ajustes/api";
import { nombreDeAlerta, useAlertas } from "../alertas/api";
import { EstadoMedidor } from "./Estado";
import { Grafico, type DatosGrafico } from "./Grafico";
import { EditarMedidor, DesvincularMedidor, EliminarMedidor, RecalibrarMedidor } from "./Gestion";
import {
  nombreMedidor,
  useConsumoHorario,
  useFallasMedidor,
  useLecturasVivo,
  useMedidor,
  useSerie,
  type Medidor,
} from "./api";

type Vista = "vivo" | "horas" | "porHora" | "porDia";
const RANGOS = [1, 6, 24, 72];
const seg = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

export default function Detalle() {
  const id = Number(useParams().id);
  const medidor = useMedidor(id);
  const navegar = useNavigate();

  const volver = (
    <button aria-label="Volver" onClick={() => navegar("/")} className="-ml-2 rounded-xl p-2 hover:bg-slate-200/60 dark:hover:bg-slate-800">
      <IcoAtras className="size-6" />
    </button>
  );

  if (medidor.isPending) return <Cargando filas={3} alto="h-40" />;
  if (medidor.isError) return <EstadoError error={medidor.error} onReintentar={() => medidor.refetch()} />;
  if (!medidor.data) {
    return (
      <>
        <Encabezado titulo="Medidor" volver={volver} />
        <EstadoVacio titulo="No encontramos este medidor" texto="Puede que se haya eliminado." accion={<Link className={claseBoton()} to="/">Ir al inicio</Link>} />
      </>
    );
  }
  return <DetalleMedidor m={medidor.data} volver={volver} />;
}

function DetalleMedidor({ m, volver }: { m: Medidor; volver: React.ReactNode }) {
  const ahora = useAhora(5_000);
  const [vista, setVista] = useState<Vista>("vivo");
  const [horas, setHoras] = useState(6);
  const [dialogo, setDialogo] = useState<null | "editar" | "desvincular" | "eliminar" | "recalibrar">(null);

  const vivo = useLecturasVivo(m.id_medidor);
  const serie = useSerie(m.id_medidor, horas, vista === "horas");
  const consumo = useConsumoHorario(m.id_medidor, 30);
  const fallas = useFallasMedidor(m.id_medidor);
  const tarifa = useTarifa();

  const ap = m.aparato;
  const umbral = ap?.alerta_activa
    ? umbralEfectivo(ap.umbral_corriente_a, ap.catalogo?.corriente_nominal_a ?? null, ap.margen_alerta_pct)
    : null;
  const ultima = vivo.data?.at(-1);
  const estado = estadoConexion(m.ultima_conexion, m.activo, ahora);
  const conFalla = fallaActiva(fallas.data?.[0]?.fecha_hora, ultima?.fecha_hora ?? null, ahora);

  // ---- datos de cada vista
  // Ventana fija de 10 min que avanza con cada actualización de datos.
  const finVivo = vivo.dataUpdatedAt;
  const ventanaVivo = useMemo<[number, number]>(() => [Math.floor(finVivo / 1000) - 600, Math.floor(finVivo / 1000)], [finVivo]);
  const datosVivo = useMemo<DatosGrafico>(
    () => ({ x: (vivo.data ?? []).map((l) => seg(l.fecha_hora)), y: (vivo.data ?? []).map((l) => l.corriente_a) }),
    [vivo.data],
  );
  const datosHoras = useMemo<DatosGrafico>(() => {
    const s = serie.data ?? [];
    return { x: s.map((p) => seg(p.t)), y: s.map((p) => p.corriente_prom), max: s.map((p) => p.corriente_max), min: s.map((p) => p.corriente_min) };
  }, [serie.data]);
  const actualizado = consumo.dataUpdatedAt;
  const tramos7d = useMemo(() => {
    const desde = actualizado - 7 * 86_400_000;
    return (consumo.data ?? []).filter((t) => new Date(t.hora).getTime() >= desde);
  }, [consumo.data, actualizado]);
  const datosPorHora = useMemo<DatosGrafico>(
    () => ({
      x: tramos7d.map((t) => seg(t.hora)),
      y: tramos7d.map((t) => t.corriente_prom),
      max: tramos7d.map((t) => t.corriente_max),
      min: tramos7d.map((t) => t.corriente_min),
    }),
    [tramos7d],
  );
  const dias = useMemo(() => agruparPorDia(consumo.data ?? [], kwh), [consumo.data]);
  const datosPorDia = useMemo<DatosGrafico>(
    () => ({ x: dias.map((d) => Math.floor(d.inicio.getTime() / 1000)), y: dias.map((d) => d.kwh) }),
    [dias],
  );

  // ---- consumo estimado
  const t = tarifa.data?.tarifa ?? 0;
  const hoyInicio = inicioDia(ahora).getTime();
  const sumaDesde = (desde: number) =>
    (consumo.data ?? []).filter((x) => new Date(x.hora).getTime() >= desde).reduce((s, x) => s + kwh(x.corriente_prom, x.muestras), 0);
  const kwhHoy = sumaDesde(hoyInicio);
  const kwh7 = sumaDesde(hoyInicio - 6 * 86_400_000);
  const kwh30 = sumaDesde(hoyInicio - 29 * 86_400_000);

  const actual = { vivo: datosVivo, horas: datosHoras, porHora: datosPorHora, porDia: datosPorDia }[vista];
  const cargandoVista =
    (vista === "vivo" && vivo.isPending) || (vista === "horas" && serie.isPending) || (vista !== "vivo" && vista !== "horas" && consumo.isPending);
  const errorVista = vista === "vivo" ? vivo.error : vista === "horas" ? serie.error : consumo.error;
  const valores = actual.y.filter((v): v is number => v != null);
  const prom = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;

  return (
    <>
      <Encabezado titulo={nombreMedidor(m)} volver={volver} />

      <Tarjeta>
        <div className="flex flex-wrap items-center gap-2">
          <EstadoMedidor estado={estado} ultimaConexion={m.ultima_conexion} ahora={ahora} />
          {conFalla && (
            <Insignia tono="rojo">
              <IcoAviso className="size-3.5" /> Con falla
            </Insignia>
          )}
          {m.recalibrar_solicitado && m.activo && <Insignia tono="azul">Recalibración pendiente</Insignia>}
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {[ap?.ubicacion?.nombre, ap?.catalogo && `${ap.catalogo.tipo} ${ap.catalogo.potencia_nominal_w} W`].filter(Boolean).join(" · ") || "Sin datos del aparato"}
        </p>
        {ultima && m.activo ? (
          <div className="mt-3 flex items-end gap-4" aria-live="polite">
            <p className="text-4xl font-bold tabular-nums">{fmtA(ultima.corriente_a)}</p>
            <p className="pb-1 text-sm text-slate-500 tabular-nums dark:text-slate-400">≈ {fmtVA(ultima.corriente_a)} estimados</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {m.activo ? "Sin lecturas en los últimos 10 minutos. El medidor envía datos cada 15 s." : "Este medidor está desvinculado."}
          </p>
        )}
      </Tarjeta>

      {/* Consumo y costo estimado */}
      <Tarjeta className="mt-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Consumo estimado</h2>
          <Link to="/ajustes" className="text-xs text-slate-500 underline dark:text-slate-400">
            Tarifa: {fmtBs(t)}/kWh{tarifa.data && !tarifa.data.configurada ? " (orientativa)" : ""}
          </Link>
        </div>
        {consumo.isPending ? (
          <Esqueleto className="mt-3 h-14" />
        ) : (
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[["Hoy", kwhHoy], ["7 días", kwh7], ["30 días", kwh30]].map(([etq, k]) => (
              <div key={etq as string} className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
                <dt className="text-xs text-slate-500 dark:text-slate-400">{etq}</dt>
                <dd className="text-base font-bold tabular-nums">{fmtBs(costoBs(k as number, t))}</dd>
                <dd className="text-xs text-slate-500 tabular-nums dark:text-slate-400">{fmtKwh(k as number)}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Estimado con corriente × 220 V (supone factor de potencia 1): la factura real suele ser algo menor.
        </p>
      </Tarjeta>

      {/* Gráficos */}
      <section className="mt-4 space-y-3" aria-label="Gráficos">
        <Pestanas<Vista>
          valor={vista}
          onCambio={setVista}
          opciones={[
            { valor: "vivo", etiqueta: "En vivo" },
            { valor: "horas", etiqueta: "Horas" },
            { valor: "porHora", etiqueta: "Por hora" },
            { valor: "porDia", etiqueta: "Por día" },
          ]}
        />
        {vista === "horas" && (
          <div className="flex gap-2">
            {RANGOS.map((h) => (
              <button
                key={h}
                onClick={() => setHoras(h)}
                aria-pressed={horas === h}
                className={cx(
                  "min-h-9 flex-1 rounded-lg text-sm font-medium ring-1",
                  horas === h ? "bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900" : "ring-slate-300 dark:ring-slate-700",
                )}
              >
                {h} h
              </button>
            ))}
          </div>
        )}
        <Tarjeta className="px-2 py-3">
          <p className="px-2 pb-2 text-sm font-semibold">
            {{ vivo: "Corriente, últimos 10 min", horas: `Corriente, últimas ${horas} h`, porHora: "Corriente promedio por hora, 7 días", porDia: "Energía por día, 30 días" }[vista]}
          </p>
          {cargandoVista ? (
            <Esqueleto className="h-56" />
          ) : errorVista ? (
            <EstadoError error={errorVista} />
          ) : actual.x.length === 0 ? (
            <p className="px-2 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              {vista === "vivo" ? "Todavía no hay lecturas recientes." : "Todavía no hay datos para este período."}
            </p>
          ) : (
            <Grafico
              datos={actual}
              tipo={vista === "porDia" ? "barras" : "linea"}
              umbral={vista === "porDia" ? null : umbral}
              unidad={vista === "porDia" ? "kWh" : "A"}
              etiquetaSerie={vista === "porDia" ? "Energía" : vista === "vivo" ? "Corriente" : "Promedio"}
              formatoX={vista === "porDia" ? "dia" : "hora"}
              descripcion={`Gráfico de ${nombreMedidor(m)}`}
              rangoX={vista === "vivo" ? ventanaVivo : undefined}
            />
          )}
          {vista !== "porDia" && prom != null && (
            <p className="px-2 pt-2 text-xs text-slate-500 tabular-nums dark:text-slate-400">
              Prom {fmtA(prom)} · Máx {fmtA(Math.max(...(actual.max?.filter((v): v is number => v != null) ?? valores)))} · Mín{" "}
              {fmtA(Math.min(...(actual.min?.filter((v): v is number => v != null) ?? valores)))}
              {umbral != null && <> · Límite {fmtA(umbral)}</>}
            </p>
          )}
          {vista === "horas" && horas === 72 && (
            <p className="px-2 pt-1 text-xs text-slate-500 dark:text-slate-400">Las lecturas segundo a segundo se guardan 3 días.</p>
          )}
          {vista === "porHora" && tramos7d.at(-1)?.parcial && (
            <p className="px-2 pt-1 text-xs text-slate-500 dark:text-slate-400">La última hora todavía está en curso.</p>
          )}
        </Tarjeta>
        {vista === "porDia" && dias.length > 0 && (
          <Tarjeta className="p-0">
            <table className="w-full text-sm">
              <caption className="sr-only">Consumo por día</caption>
              <thead className="text-left text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Día</th>
                  <th className="px-2 py-2 text-right font-medium">Prom.</th>
                  <th className="px-2 py-2 text-right font-medium">Energía</th>
                  <th className="px-4 py-2 text-right font-medium">Costo</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[...dias].reverse().map((d) => (
                  <tr key={d.dia} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2 capitalize">{fmtDia(d.inicio)}</td>
                    <td className="px-2 py-2 text-right">{fmtA(d.prom)}</td>
                    <td className="px-2 py-2 text-right">{fmtKwh(d.kwh)}</td>
                    <td className="px-4 py-2 text-right font-medium">{fmtBs(costoBs(d.kwh, t))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
        )}
      </section>

      {/* Fallas */}
      <section className="mt-6">
        <h2 className="mb-2 font-semibold">Fallas del medidor</h2>
        {fallas.isPending ? (
          <Esqueleto className="h-16" />
        ) : fallas.isError ? (
          <EstadoError error={fallas.error} onReintentar={() => fallas.refetch()} />
        ) : fallas.data.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Sin fallas registradas ✅</p>
        ) : (
          <ul className="space-y-2">
            {fallas.data.slice(0, 10).map((f, i) => {
              const info = infoFalla(f.codigo);
              const activa = i === 0 && conFalla;
              return (
                <li key={f.id_falla}>
                  <details className="group rounded-2xl bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800" open={activa}>
                    <summary className="flex cursor-pointer list-none items-center gap-2">
                      <IcoAviso className={cx("size-5 shrink-0", activa ? "text-red-600" : "text-slate-400")} />
                      <span className="flex-1 text-sm font-medium">{info.titulo}</span>
                      <span className="text-xs text-slate-500">{haceCuanto(f.fecha_hora, ahora)}</span>
                    </summary>
                    <div className="mt-2 space-y-2 pl-7 text-sm">
                      <p className="text-slate-600 dark:text-slate-300">{info.explicacion}</p>
                      <p><strong>Qué hacer:</strong> {info.queHacer}</p>
                      <p className="text-xs text-slate-500">
                        {fmtFechaHora(f.fecha_hora)}{f.bias_v != null && ` · voltaje medido ${Number(f.bias_v).toFixed(2)} V`}
                      </p>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AlertasRecientes idMedidor={m.id_medidor} />

      {/* Gestión */}
      <section className="mt-6 space-y-2">
        <h2 className="font-semibold">Gestionar</h2>
        <div className="grid grid-cols-2 gap-2">
          <Boton variante="secundario" onClick={() => setDialogo("editar")} disabled={!ap}>Editar</Boton>
          <Link to={`/medidor/${m.id_medidor}/alertas`} className={claseBoton("secundario")}>Alertas</Link>
          {m.activo && (
            <Boton variante="secundario" className="col-span-2" onClick={() => setDialogo("recalibrar")}>
              Recalibrar cero
            </Boton>
          )}
          {m.activo && (
            <Boton variante="secundario" onClick={() => setDialogo("desvincular")}>Desvincular</Boton>
          )}
          <Boton variante="peligro" onClick={() => setDialogo("eliminar")} className={m.activo ? "" : "col-span-2"}>
            Eliminar
          </Boton>
        </div>
        {!m.activo && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Para volver a usar este ESP32, ve a <Link to="/agregar" className="underline">Agregar medidor</Link> y vincúlalo con un código nuevo: el historial se conserva.
          </p>
        )}
        <p className="pt-2 text-xs text-slate-400">
          Firmware {m.firmware_version ?? "—"} · vinculado el {fmtFechaHora(m.creado_en)}
        </p>
      </section>

      <EditarMedidor m={m} abierto={dialogo === "editar"} onCerrar={() => setDialogo(null)} />
      <RecalibrarMedidor m={m} abierto={dialogo === "recalibrar"} onCerrar={() => setDialogo(null)} />
      <DesvincularMedidor m={m} abierto={dialogo === "desvincular"} onCerrar={() => setDialogo(null)} />
      <EliminarMedidor m={m} abierto={dialogo === "eliminar"} onCerrar={() => setDialogo(null)} />
    </>
  );
}

function AlertasRecientes({ idMedidor }: { idMedidor: number }) {
  const alertas = useAlertas(false, idMedidor);
  const lista = alertas.data?.pages[0]?.slice(0, 5) ?? [];
  if (alertas.isPending || lista.length === 0) return null;
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold">Alertas recientes</h2>
        <Link to="/alertas" className="text-sm text-amber-700 underline dark:text-amber-400">Ver todas</Link>
      </div>
      <ul className="divide-y divide-slate-200 rounded-2xl bg-white ring-1 ring-slate-200 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        {lista.map((a) => (
          <li key={a.id_alerta} className="flex items-center gap-2 px-4 py-3 text-sm">
            {!a.leida && <span className="size-2 rounded-full bg-amber-500" aria-label="Sin leer" />}
            <span className="flex-1">
              {fmtA(Number(a.corriente_a))} <span className="text-slate-500">(límite {fmtA(Number(a.umbral_a))})</span>
            </span>
            <span className="text-xs text-slate-500" title={nombreDeAlerta(a)}>{fmtFechaHora(a.fecha_hora)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
