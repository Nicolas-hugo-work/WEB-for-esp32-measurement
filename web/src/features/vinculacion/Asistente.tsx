import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Boton, Campo, Encabezado, Entrada, Selector, Spinner, Tarjeta, claseBoton, cx } from "../../components/ui";
import { Cargando, EstadoError } from "../../components/Estados";
import { Dialogo } from "../../components/Dialogo";
import { IcoCheck, IcoCopiar } from "../../components/Iconos";
import { useAviso } from "../../components/avisos";
import { formatearCodigo, mmss, segundosRestantes } from "../../lib/codigo";
import { mensajeError } from "../../lib/errores";
import { useAhora } from "../../lib/hooks";
import { fmtA } from "../../lib/electrica";
import { useUsuario } from "../../auth/contexto";
import { describirAparato, useCatalogo } from "../catalogo/api";
import { FormAparato } from "../catalogo/FormAparato";
import { useCrearUbicacion, useUbicaciones } from "../ubicaciones/api";
import { codigoGuardado, useCodigosPendientes, useEstadoCodigo, useGenerarCodigo, type CodigoPendiente } from "./api";

export function Asistente() {
  const [pendiente, setPendiente] = useState<CodigoPendiente | null>(() => codigoGuardado.leer());
  const [vinculado, setVinculado] = useState<{ id: number; alias: string | null } | null>(null);

  function usarCodigo(c: CodigoPendiente) {
    codigoGuardado.guardar(c);
    setPendiente(c);
  }

  if (vinculado) return <Listo {...vinculado} />;
  if (pendiente) {
    return (
      <PasoCodigo
        pendiente={pendiente}
        onVinculado={(id) => {
          codigoGuardado.borrar();
          setVinculado({ id, alias: pendiente.alias });
        }}
        onNuevo={() => {
          codigoGuardado.borrar();
          setPendiente(null);
        }}
      />
    );
  }
  return <PasoAparato onCodigo={usarCodigo} />;
}

// --------------------------------------------------------------- paso 1
function PasoAparato({ onCodigo }: { onCodigo: (c: CodigoPendiente) => void }) {
  const usuario = useUsuario();
  const catalogo = useCatalogo();
  const ubicaciones = useUbicaciones();
  const pendientes = useCodigosPendientes();
  const crearUbicacion = useCrearUbicacion();
  const generar = useGenerarCodigo();
  const avisar = useAviso();

  const [busqueda, setBusqueda] = useState("");
  const [idCatalogo, setIdCatalogo] = useState<number | null>(null);
  const [idUbicacion, setIdUbicacion] = useState<number | null>(null);
  const [nuevaUbicacion, setNuevaUbicacion] = useState<string | null>(null);
  const [alias, setAlias] = useState("");
  const [crearAparato, setCrearAparato] = useState(false);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = catalogo.data ?? [];
    return q ? lista.filter((a) => describirAparato(a).toLowerCase().includes(q)) : lista;
  }, [catalogo.data, busqueda]);
  const elegido = catalogo.data?.find((a) => a.id_catalogo === idCatalogo);

  function generarCodigo() {
    if (!idCatalogo) return;
    generar.mutate(
      { id_catalogo: idCatalogo, id_ubicacion: idUbicacion, alias: alias || elegido?.tipo || "" },
      {
        onSuccess: onCodigo,
        onError: (e) => {
          // Si el aparato o la ubicación ya no existen, se recargan las listas.
          if (/aparato|ubicacion/i.test((e as Error).message ?? "")) {
            catalogo.refetch();
            ubicaciones.refetch();
          }
          pendientes.refetch();
        },
      },
    );
  }

  function agregarUbicacion() {
    if (!nuevaUbicacion?.trim()) return;
    crearUbicacion.mutate(
      { nombre: nuevaUbicacion, id_usuario: usuario.id },
      {
        onSuccess: (u) => {
          setIdUbicacion(u.id_ubicacion);
          setNuevaUbicacion(null);
        },
        onError: (e) =>
          avisar((e as { code?: string }).code === "23505" ? "Ya tienes una ubicación con ese nombre." : mensajeError(e), "error"),
      },
    );
  }

  return (
    <>
      <Encabezado titulo="Agregar medidor" />
      <ol className="mb-4 flex gap-2 text-xs font-medium" aria-label="Pasos">
        {["Aparato", "Código", "Conectar"].map((p, i) => (
          <li key={p} className={cx("flex-1 rounded-full py-1 text-center", i === 0 ? "bg-amber-500 text-slate-950" : "bg-slate-200 text-slate-500 dark:bg-slate-800")}>
            {i + 1}. {p}
          </li>
        ))}
      </ol>

      {!!pendientes.data?.length && (
        <Tarjeta className="mb-4 bg-amber-50 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900">
          <p className="text-sm font-medium">Tienes {pendientes.data.length === 1 ? "un código sin usar" : `${pendientes.data.length} códigos sin usar`}</p>
          <ul className="mt-2 space-y-2">
            {pendientes.data.map((c) => (
              <li key={c.codigo} className="flex items-center gap-2 text-sm">
                <span className="font-mono font-semibold">{formatearCodigo(c.codigo)}</span>
                <span className="flex-1 truncate text-slate-500">{c.alias}</span>
                <Boton variante="secundario" className="min-h-9 px-3" onClick={() => onCodigo(c)}>Retomar</Boton>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">¿Qué aparato vas a medir?</h2>
        <Entrada type="search" aria-label="Buscar aparato" placeholder="Buscar…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        {catalogo.isPending ? (
          <Cargando filas={3} alto="h-12" />
        ) : catalogo.isError ? (
          <EstadoError error={catalogo.error} onReintentar={() => catalogo.refetch()} />
        ) : (
          <div role="radiogroup" aria-label="Aparato" className="max-h-72 space-y-1.5 overflow-y-auto">
            {filtrados.map((a) => (
              <button
                key={a.id_catalogo}
                role="radio"
                aria-checked={idCatalogo === a.id_catalogo}
                onClick={() => setIdCatalogo(a.id_catalogo)}
                className={cx(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition",
                  idCatalogo === a.id_catalogo
                    ? "bg-amber-50 ring-2 ring-amber-500 dark:bg-amber-950/30"
                    : "bg-white ring-slate-200 dark:bg-slate-900 dark:ring-slate-800",
                )}
              >
                <span className="flex-1">
                  <span className="block font-medium">{describirAparato(a)}</span>
                  <span className="block text-xs text-slate-500">
                    {a.potencia_nominal_w} W · {fmtA(Number(a.corriente_nominal_a))}{a.es_global ? "" : " · mío"}
                  </span>
                </span>
                {idCatalogo === a.id_catalogo && <IcoCheck className="size-5 text-amber-600" />}
              </button>
            ))}
            {filtrados.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No hay aparatos con ese nombre.</p>}
          </div>
        )}
        <Boton variante="fantasma" className="px-0 text-amber-700 dark:text-amber-400" onClick={() => setCrearAparato(true)}>
          + Mi aparato no está: crearlo
        </Boton>
      </section>

      <section className="mt-4 space-y-4">
        <Campo etiqueta="Ubicación (opcional)" htmlFor="as-ubic">
          {nuevaUbicacion === null ? (
            <div className="flex gap-2">
              <Selector id="as-ubic" value={idUbicacion ?? ""} onChange={(e) => setIdUbicacion(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Sin ubicación</option>
                {ubicaciones.data?.map((u) => <option key={u.id_ubicacion} value={u.id_ubicacion}>{u.nombre}</option>)}
              </Selector>
              <Boton variante="secundario" onClick={() => setNuevaUbicacion("")}>Nueva</Boton>
            </div>
          ) : (
            <div className="flex gap-2">
              <Entrada id="as-ubic" autoFocus placeholder="Ej. Cocina" maxLength={40} value={nuevaUbicacion} onChange={(e) => setNuevaUbicacion(e.target.value)} />
              <Boton onClick={agregarUbicacion} cargando={crearUbicacion.isPending}>Crear</Boton>
              <Boton variante="fantasma" className="px-2" onClick={() => setNuevaUbicacion(null)}>✕</Boton>
            </div>
          )}
        </Campo>
        <Campo etiqueta="Nombre del medidor" htmlFor="as-alias" ayuda="Para reconocerlo en el panel y en los avisos.">
          <Entrada id="as-alias" maxLength={60} placeholder={elegido ? `Ej. ${elegido.tipo} cocina` : "Ej. Refri cocina"} value={alias} onChange={(e) => setAlias(e.target.value)} />
        </Campo>
        {generar.isError && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
            {mensajeError(generar.error)}
          </p>
        )}
        <Boton bloque disabled={!idCatalogo} cargando={generar.isPending} onClick={generarCodigo}>
          Generar código
        </Boton>
      </section>

      <Dialogo abierto={crearAparato} onCerrar={() => setCrearAparato(false)} titulo="Nuevo aparato">
        {crearAparato && (
          <FormAparato
            onCancelar={() => setCrearAparato(false)}
            onListo={(id) => {
              setIdCatalogo(id);
              setCrearAparato(false);
            }}
          />
        )}
      </Dialogo>
    </>
  );
}

// --------------------------------------------------------------- pasos 2 y 3
function PasoCodigo({ pendiente, onVinculado, onNuevo }: {
  pendiente: CodigoPendiente;
  onVinculado: (idMedidor: number) => void;
  onNuevo: () => void;
}) {
  const ahora = useAhora(1_000);
  const restantes = segundosRestantes(pendiente.vence_en, ahora);
  const vencido = restantes === 0;
  const estado = useEstadoCodigo(pendiente.codigo, vencido);
  const qc = useQueryClient();
  const [copiado, setCopiado] = useState(false);
  const codigo = formatearCodigo(pendiente.codigo);

  const idMedidor = estado.data?.usado_en ? estado.data.id_medidor : null;
  useEffect(() => {
    if (idMedidor) {
      qc.invalidateQueries({ queryKey: ["medidores"] });
      qc.invalidateQueries({ queryKey: ["codigos"] });
      onVinculado(idMedidor);
    }
  }, [idMedidor, onVinculado, qc]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sin portapapeles: el código está a la vista */
    }
  }

  return (
    <>
      <Encabezado titulo="Agregar medidor" />
      <Tarjeta className="text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">Tu código{pendiente.alias ? ` para «${pendiente.alias}»` : ""}</p>
        <p className={cx("my-2 font-mono text-4xl font-bold tracking-widest tabular-nums", vencido && "text-slate-400 line-through")}>{codigo}</p>
        {vencido ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm font-medium text-red-600">El código venció.</p>
            <Boton onClick={onNuevo}>Generar uno nuevo</Boton>
          </div>
        ) : (
          <>
            <Boton variante="secundario" className="min-h-9 px-3" onClick={copiar}>
              {copiado ? <IcoCheck className="size-4" /> : <IcoCopiar className="size-4" />} {copiado ? "Copiado" : "Copiar"}
            </Boton>
            <div className="mt-3">
              <p className="text-sm tabular-nums" aria-live="off">Vence en <strong>{mmss(restantes)}</strong></p>
              <div className="mx-auto mt-1 h-1.5 max-w-60 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-full bg-amber-500 transition-[width] duration-1000" style={{ width: `${(restantes / 900) * 100}%` }} />
              </div>
            </div>
          </>
        )}
      </Tarjeta>

      {!vencido && (
        <>
          <Tarjeta className="mt-4">
            <h2 className="mb-3 font-semibold">Conecta el medidor</h2>
            <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
              <li>Enchufa el medidor con el <strong>aparato APAGADO</strong>: al encender mide el «cero» durante unos segundos.</li>
              <li>En tu celular abre los ajustes de <strong>WiFi</strong> y conéctate a la red <strong>«Medidor-XXXX»</strong>.</li>
              <li>Se abrirá una página sola. Si no aparece, abre el navegador y entra a <strong>192.168.4.1</strong>.</li>
              <li>
                Toca <strong>«Configure WiFi»</strong>, elige la red de tu casa (debe ser de <strong>2,4 GHz</strong>), escribe su contraseña y en
                <strong> «Código de la web»</strong> escribe <span className="font-mono font-semibold">{codigo}</span>. Toca <strong>«Save»</strong>.
              </li>
              <li>Vuelve a tu WiFi de siempre y regresa a esta página: te avisamos cuando el medidor se conecte.</li>
            </ol>
          </Tarjeta>

          <div role="status" className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Spinner className="text-amber-500" /> Esperando que el medidor se conecte…
          </div>
          {estado.isError && (
            <p className="mt-2 text-center text-xs text-slate-500">Sin conexión por ahora; seguimos intentando cuando vuelva internet.</p>
          )}
        </>
      )}

      <div className="mt-6 space-y-2">
        <details className="rounded-2xl bg-white p-3 text-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <summary className="cursor-pointer font-medium">¿La pantalla del medidor dice «CODIGO INVALIDO»?</summary>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            El código está mal escrito o venció. El medidor vuelve a abrir su red WiFi solo: conéctate otra vez y escribe el código con cuidado
            (no importan los guiones ni las mayúsculas). Si venció, genera uno nuevo.
          </p>
        </details>
        <details className="rounded-2xl bg-white p-3 text-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <summary className="cursor-pointer font-medium">¿No aparece la red «Medidor-XXXX»?</summary>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Desenchufa el medidor 10 segundos y vuelve a enchufarlo. Si estaba vinculado a otra cuenta o a otro medidor, primero hay que
            desvincularlo o eliminarlo en esa cuenta: al reconectarse borrará su vinculación y abrirá la red.
          </p>
        </details>
        <Boton variante="fantasma" bloque onClick={onNuevo}>Empezar de nuevo con otro aparato</Boton>
      </div>
    </>
  );
}

function Listo({ id, alias }: { id: number; alias: string | null }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
        <IcoCheck className="size-8" />
      </span>
      <h1 className="text-xl font-bold">¡Listo!</h1>
      <p className="max-w-xs text-slate-600 dark:text-slate-300">
        {alias ? `«${alias}»` : "Tu medidor"} quedó vinculado. Las primeras lecturas llegan en unos 15 segundos.
      </p>
      <Link to={`/medidor/${id}`} className={claseBoton()}>Ver medidor</Link>
      <Link to="/" className="text-sm text-slate-500 underline">Ir al inicio</Link>
    </div>
  );
}
