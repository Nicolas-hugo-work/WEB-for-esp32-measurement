import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { z } from "zod";
import { Boton, Campo, Encabezado, Entrada, Interruptor, Tarjeta, claseBoton, cx } from "../../components/ui";
import { Cargando, EstadoError, EstadoVacio } from "../../components/Estados";
import { IcoAtras } from "../../components/Iconos";
import { useAviso } from "../../components/avisos";
import { fmtA, umbralEfectivo } from "../../lib/electrica";
import { mensajeError } from "../../lib/errores";
import { nombreMedidor, useGuardarAlertas, useMedidor, type Medidor } from "../medidores/api";

/** Mismos límites que los CHECK de aparatos_instalados. */
const esquema = z.object({
  margen: z.coerce.number({ message: "Escribe un número" }).int("Sin decimales").min(0, "No puede ser negativo").max(1000, "Máximo 1000 %"),
  segundos: z.coerce.number({ message: "Escribe un número" }).int("Sin decimales").min(1, "Mínimo 1 s").max(600, "Máximo 600 s"),
  umbral: z.coerce.number({ message: "Escribe un número" }).positive("Debe ser mayor que 0").max(9999),
});

export function ConfigAlertas() {
  const id = Number(useParams().id);
  const medidor = useMedidor(id);
  const navegar = useNavigate();
  const volver = (
    <button aria-label="Volver" onClick={() => navegar(`/medidor/${id}`)} className="-ml-2 rounded-xl p-2 hover:bg-slate-200/60 dark:hover:bg-slate-800">
      <IcoAtras className="size-6" />
    </button>
  );
  if (medidor.isPending) return <Cargando filas={2} />;
  if (medidor.isError) return <EstadoError error={medidor.error} onReintentar={() => medidor.refetch()} />;
  if (!medidor.data?.aparato) {
    return (
      <>
        <Encabezado titulo="Alertas" volver={volver} />
        <EstadoVacio titulo="No encontramos este medidor" accion={<Link to="/" className={claseBoton()}>Ir al inicio</Link>} />
      </>
    );
  }
  return (
    <>
      <Encabezado titulo={`Alertas de «${nombreMedidor(medidor.data)}»`} volver={volver} />
      <Formulario m={medidor.data} />
    </>
  );
}

function Formulario({ m }: { m: Medidor }) {
  const ap = m.aparato!;
  const nominal = ap.catalogo?.corriente_nominal_a != null ? Number(ap.catalogo.corriente_nominal_a) : null;
  const guardar = useGuardarAlertas();
  const avisar = useAviso();
  const navegar = useNavigate();

  const [activa, setActiva] = useState(ap.alerta_activa);
  const [modo, setModo] = useState<"auto" | "fijo">(ap.umbral_corriente_a != null ? "fijo" : "auto");
  const [margen, setMargen] = useState(String(ap.margen_alerta_pct));
  const [umbral, setUmbral] = useState(ap.umbral_corriente_a != null ? String(ap.umbral_corriente_a) : "");
  const [segundos, setSegundos] = useState(String(ap.segundos_sostenido));
  const [errores, setErrores] = useState<Record<string, string>>({});

  const num = (s: string) => Number(s.replace(",", "."));
  const resultado =
    modo === "auto" ? umbralEfectivo(null, nominal, num(margen) || 0) : Number.isFinite(num(umbral)) && num(umbral) > 0 ? num(umbral) : null;

  function enviar(e: FormEvent) {
    e.preventDefault();
    const r = esquema.safeParse({
      margen: num(margen),
      segundos: num(segundos),
      umbral: modo === "fijo" ? num(umbral) : 1,
    });
    if (!r.success) {
      setErrores(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrores({});
    guardar.mutate(
      {
        id_aparato: ap.id_aparato,
        alerta_activa: activa,
        umbral_corriente_a: modo === "fijo" ? r.data.umbral : null,
        margen_alerta_pct: r.data.margen,
        segundos_sostenido: r.data.segundos,
      },
      {
        onSuccess: () => {
          avisar("Alertas guardadas");
          navegar(`/medidor/${m.id_medidor}`);
        },
      },
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Tarjeta className="flex items-center gap-3">
        <label htmlFor="alerta-activa" className="flex-1 font-medium">Avisarme cuando consuma de más</label>
        <Interruptor id="alerta-activa" etiqueta="Alertas activas" activo={activa} onCambio={setActiva} />
      </Tarjeta>

      <fieldset disabled={!activa} className={cx("space-y-4", !activa && "opacity-50")}>
        <Tarjeta className="space-y-3">
          <p className="font-medium">Límite</p>
          <label className="flex items-start gap-3">
            <input type="radio" name="modo" className="mt-1 size-4 accent-amber-500" checked={modo === "auto"} onChange={() => setModo("auto")} />
            <span className="flex-1 space-y-2">
              <span className="block">Automático: lo normal del aparato + un margen</span>
              {modo === "auto" && (
                <span className="flex items-center gap-2 text-sm">
                  {nominal != null ? fmtA(nominal) : "—"} +
                  <Entrada aria-label="Margen en %" inputMode="numeric" className="w-20" value={margen} onChange={(e) => setMargen(e.target.value)} />%
                </span>
              )}
              {errores.margen && <span role="alert" className="block text-sm text-red-600">{errores.margen}</span>}
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="radio" name="modo" className="mt-1 size-4 accent-amber-500" checked={modo === "fijo"} onChange={() => setModo("fijo")} />
            <span className="flex-1 space-y-2">
              <span className="block">Fijo: elijo los amperios</span>
              {modo === "fijo" && (
                <span className="flex items-center gap-2 text-sm">
                  <Entrada aria-label="Límite en amperios" inputMode="decimal" className="w-28" value={umbral} onChange={(e) => setUmbral(e.target.value)} placeholder="Ej. 1,5" /> A
                </span>
              )}
              {errores.umbral && <span role="alert" className="block text-sm text-red-600">{errores.umbral}</span>}
            </span>
          </label>
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800" aria-live="polite">
            Te avisaremos si pasa de <strong>{resultado != null ? fmtA(resultado) : "—"}</strong>
          </p>
        </Tarjeta>

        <Tarjeta>
          <Campo etiqueta="Durante al menos (segundos seguidos)" htmlFor="segundos" error={errores.segundos} ayuda="Entre 1 y 600. Evita avisos por picos de arranque.">
            <Entrada id="segundos" inputMode="numeric" value={segundos} onChange={(e) => setSegundos(e.target.value)} className="w-28" />
          </Campo>
        </Tarjeta>
      </fieldset>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Como máximo 1 aviso cada 30 minutos por medidor. Te avisamos por correo y con notificación push (actívala en Ajustes).
      </p>
      {guardar.isError && <p role="alert" className="text-sm text-red-600">{mensajeError(guardar.error)}</p>}
      <Boton type="submit" bloque cargando={guardar.isPending}>Guardar</Boton>
    </form>
  );
}
