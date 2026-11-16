import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Dialogo } from "../../components/Dialogo";
import { Boton, Campo, Entrada, Selector } from "../../components/ui";
import { useAviso } from "../../components/avisos";
import { mensajeError } from "../../lib/errores";
import { describirAparato, useCatalogo } from "../catalogo/api";
import { useUbicaciones } from "../ubicaciones/api";
import {
  firmwareRecalibra,
  nombreMedidor,
  useDesvincular,
  useEliminarMedidor,
  useGuardarMedidor,
  useRecalibrar,
  type Medidor,
} from "./api";

interface Props {
  m: Medidor;
  abierto: boolean;
  onCerrar: () => void;
}

export function EditarMedidor({ m, abierto, onCerrar }: Props) {
  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Editar medidor">
      {abierto && m.aparato && <FormEditar m={m} onCerrar={onCerrar} />}
    </Dialogo>
  );
}

function FormEditar({ m, onCerrar }: { m: Medidor; onCerrar: () => void }) {
  const ap = m.aparato!;
  const catalogo = useCatalogo();
  const ubicaciones = useUbicaciones();
  const guardar = useGuardarMedidor();
  const avisar = useAviso();
  const [nombre, setNombre] = useState(nombreMedidor(m));
  const [idCatalogo, setIdCatalogo] = useState(ap.id_catalogo);
  const [idUbicacion, setIdUbicacion] = useState<number | null>(ap.id_ubicacion);

  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate(
      { id_medidor: m.id_medidor, id_aparato: ap.id_aparato, nombre, id_catalogo: idCatalogo, id_ubicacion: idUbicacion },
      {
        onSuccess: () => {
          avisar("Cambios guardados");
          onCerrar();
        },
      },
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="Nombre" htmlFor="ed-nombre" ayuda="Se usa en el panel y en los avisos.">
        <Entrada id="ed-nombre" value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      <Campo etiqueta="Aparato" htmlFor="ed-aparato" ayuda="Cambiarlo cambia el límite automático de alerta.">
        <Selector id="ed-aparato" value={idCatalogo} onChange={(e) => setIdCatalogo(Number(e.target.value))}>
          {catalogo.data?.map((a) => (
            <option key={a.id_catalogo} value={a.id_catalogo}>
              {describirAparato(a)} · {a.potencia_nominal_w} W{a.es_global ? "" : " (mío)"}
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Ubicación" htmlFor="ed-ubic">
        <Selector
          id="ed-ubic"
          value={idUbicacion ?? ""}
          onChange={(e) => setIdUbicacion(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Sin ubicación</option>
          {ubicaciones.data?.map((u) => (
            <option key={u.id_ubicacion} value={u.id_ubicacion}>{u.nombre}</option>
          ))}
        </Selector>
      </Campo>
      {guardar.isError && <p role="alert" className="text-sm text-red-600">{mensajeError(guardar.error)}</p>}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
        <Boton type="submit" cargando={guardar.isPending}>Guardar</Boton>
      </div>
    </form>
  );
}

const avisoApagado = "Si el ESP32 está apagado o sin internet, se desvinculará cuando vuelva a conectarse.";

export function DesvincularMedidor({ m, abierto, onCerrar }: Props) {
  const desvincular = useDesvincular();
  const avisar = useAviso();
  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo={`Desvincular «${nombreMedidor(m)}»`}>
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <p>El ESP32 dejará de enviar datos. La próxima vez que se conecte borrará su vinculación y volverá a abrir su red WiFi «Medidor-XXXX».</p>
        <p><strong>El historial se conserva.</strong> Para volver a usarlo, genera un código nuevo en «Agregar medidor» y vincúlalo a esta misma cuenta.</p>
        <p className="text-xs">{avisoApagado}</p>
      </div>
      {desvincular.isError && <p role="alert" className="mt-3 text-sm text-red-600">{mensajeError(desvincular.error)}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
        <Boton
          cargando={desvincular.isPending}
          onClick={() =>
            desvincular.mutate(m.id_medidor, {
              onSuccess: () => {
                avisar("Medidor desvinculado");
                onCerrar();
              },
            })
          }
        >
          Desvincular
        </Boton>
      </div>
    </Dialogo>
  );
}

export function EliminarMedidor({ m, abierto, onCerrar }: Props) {
  const eliminar = useEliminarMedidor();
  const navegar = useNavigate();
  const avisar = useAviso();
  const [confirmacion, setConfirmacion] = useState("");
  const nombre = nombreMedidor(m);
  const ok = confirmacion.trim().toLowerCase() === nombre.trim().toLowerCase();

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={() => {
        setConfirmacion("");
        onCerrar();
      }}
      titulo={`Eliminar «${nombre}»`}
    >
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <p>
          Se borran <strong>para siempre</strong> sus lecturas, el resumen por hora, las fallas y las alertas.
        </p>
        <p>El ESP32 se desvinculará solo la próxima vez que se conecte y abrirá su red WiFi para vincularlo de nuevo.</p>
        <p className="text-xs">{avisoApagado}</p>
      </div>
      <div className="mt-4">
        <Campo etiqueta={`Escribe «${nombre}» para confirmar`} htmlFor="conf-eliminar">
          <Entrada id="conf-eliminar" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="off" />
        </Campo>
      </div>
      {eliminar.isError && <p role="alert" className="mt-3 text-sm text-red-600">{mensajeError(eliminar.error)}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
        <Boton
          variante="peligro"
          disabled={!ok}
          cargando={eliminar.isPending}
          onClick={() =>
            eliminar.mutate(m.id_medidor, {
              onSuccess: () => {
                avisar("Medidor eliminado");
                navegar("/", { replace: true });
              },
            })
          }
        >
          Eliminar para siempre
        </Boton>
      </div>
    </Dialogo>
  );
}

export function RecalibrarMedidor({ m, abierto, onCerrar }: Props) {
  const recalibrar = useRecalibrar();
  const avisar = useAviso();
  const compatible = firmwareRecalibra(m.firmware_version);
  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Recalibrar el cero">
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <p>Úsalo si el medidor marca corriente con el aparato apagado.</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li><strong>Apaga el aparato</strong> (o saca el sensor del cable) antes de continuar.</li>
          <li>Toca «Recalibrar». El medidor recibe el pedido en su próximo envío (hasta 15 s).</li>
          <li>La pantalla del medidor muestra «CALIBRO RUIDO». <strong>No enciendas el aparato</strong> hasta que vuelva a mostrar la corriente (unos 30 s en total).</li>
        </ol>
        {!compatible && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Este medidor tiene el firmware {m.firmware_version}: para recalibrar desde la web hay que subirle la versión 2.1.0 o posterior.
          </p>
        )}
      </div>
      {recalibrar.isError && <p role="alert" className="mt-3 text-sm text-red-600">{mensajeError(recalibrar.error)}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
        <Boton
          cargando={recalibrar.isPending}
          onClick={() =>
            recalibrar.mutate(m.id_medidor, {
              onSuccess: () => {
                avisar("Pedido enviado: mantén el aparato apagado unos 30 s");
                onCerrar();
              },
            })
          }
        >
          Recalibrar
        </Boton>
      </div>
    </Dialogo>
  );
}
