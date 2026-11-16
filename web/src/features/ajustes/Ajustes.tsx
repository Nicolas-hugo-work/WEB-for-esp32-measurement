import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boton, Campo, Encabezado, Entrada, Insignia, Tarjeta } from "../../components/ui";
import { Dialogo } from "../../components/Dialogo";
import { useAviso } from "../../components/avisos";
import { supabase } from "../../lib/supabase";
import { mensajeError, sinError } from "../../lib/errores";
import { fmtBs, TARIFA_POR_DEFECTO } from "../../lib/electrica";
import { useUsuario } from "../../auth/contexto";
import { useEsAdmin } from "../catalogo/api";
import { activarPush, desactivarPush, describirDispositivo, esIOS, esPWAInstalada, pushSoportado, suscripcionActual } from "../push/push";
import { useGuardarTarifa, useTarifa } from "./api";

export function useCerrarSesion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Primero se quita el push de este navegador (si no, el próximo usuario chocaría con el endpoint).
      await desactivarPush().catch(() => {});
      await supabase.auth.signOut();
    },
    onSettled: () => qc.clear(),
  });
}

export function Ajustes() {
  const usuario = useUsuario();
  const esAdmin = useEsAdmin().data;
  const cerrar = useCerrarSesion();
  const [cambiarClave, setCambiarClave] = useState(false);

  return (
    <>
      <Encabezado titulo="Ajustes" />
      <div className="space-y-4">
        <SeccionPush />
        <SeccionTarifa />
        <Tarjeta className="space-y-3">
          <h2 className="font-semibold">Cuenta</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {usuario.email} {esAdmin && <Insignia tono="azul">Administrador</Insignia>}
          </p>
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" onClick={() => setCambiarClave(true)}>Cambiar contraseña</Boton>
            <Boton variante="secundario" cargando={cerrar.isPending} onClick={() => cerrar.mutate()}>Cerrar sesión</Boton>
          </div>
        </Tarjeta>
      </div>
      <Dialogo abierto={cambiarClave} onCerrar={() => setCambiarClave(false)} titulo="Cambiar contraseña">
        {cambiarClave && <FormClave onListo={() => setCambiarClave(false)} />}
      </Dialogo>
    </>
  );
}

function SeccionPush() {
  const usuario = useUsuario();
  const avisar = useAviso();
  const qc = useQueryClient();
  const soportado = pushSoportado();
  const iosSinInstalar = esIOS() && !esPWAInstalada();
  const [permiso, setPermiso] = useState(() => (typeof Notification !== "undefined" ? Notification.permission : "default"));

  const actual = useQuery({ queryKey: ["push", "actual"], queryFn: suscripcionActual, enabled: soportado });
  const dispositivos = useQuery({
    queryKey: ["push", "dispositivos"],
    queryFn: async () =>
      sinError(await supabase.from("push_suscripciones").select("id_suscripcion, endpoint, user_agent, creado_en").order("creado_en")),
  });
  const refrescar = () => qc.invalidateQueries({ queryKey: ["push"] });

  const activar = useMutation({
    mutationFn: () => activarPush(usuario.id),
    onSuccess: () => avisar("Avisos activados en este dispositivo"),
    onSettled: () => {
      setPermiso(Notification.permission);
      refrescar();
    },
  });
  const quitar = useMutation({
    mutationFn: async (endpoint: string) => {
      if (endpoint === actual.data?.endpoint) await desactivarPush();
      else {
        const r = await supabase.from("push_suscripciones").delete().eq("endpoint", endpoint);
        if (r.error) throw r.error;
      }
    },
    onSettled: refrescar,
  });

  const activo = Boolean(actual.data && dispositivos.data?.some((d) => d.endpoint === actual.data!.endpoint));
  const errorActivar = activar.error
    ? (activar.error as Error).message === "permiso_denegado"
      ? "No diste permiso para avisos."
      : (activar.error as Error).message === "sin_vapid"
        ? "Falta configurar la clave pública de avisos (VITE_VAPID_PUBLIC_KEY)."
        : (activar.error as Error).message === "push_sin_respuesta"
          ? "El servicio de avisos del navegador no respondió. Intenta de nuevo en un momento."
          : /permission denied/i.test((activar.error as Error).message)
          ? "El navegador no permite avisos aquí (¿ventana de incógnito?)."
          : mensajeError(activar.error, "No se pudieron activar los avisos.")
    : null;

  return (
    <Tarjeta className="space-y-3">
      <h2 className="font-semibold">Notificaciones en este dispositivo</h2>
      {iosSinInstalar ? (
        <div className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          <p className="font-medium">En iPhone, primero instala la app:</p>
          <ol className="mt-1 list-decimal pl-5">
            <li>Abre esta página en <strong>Safari</strong>.</li>
            <li>Toca <strong>Compartir</strong> (cuadrado con flecha) → <strong>Agregar a inicio</strong>.</li>
            <li>Abre «Mi Consumo» desde el ícono y vuelve aquí para activar los avisos.</li>
          </ol>
        </div>
      ) : !soportado ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Este navegador no admite avisos{!window.isSecureContext ? " en una dirección sin HTTPS" : ""}. Te llegarán por correo.
        </p>
      ) : permiso === "denied" ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Bloqueaste los avisos para este sitio. Para activarlos, abre los permisos del sitio en tu navegador (ícono junto a la dirección) y
          permite «Notificaciones».
        </p>
      ) : activo ? (
        <div className="flex items-center gap-3">
          <Insignia tono="verde">Activados</Insignia>
          <Boton variante="secundario" className="min-h-9 px-3" cargando={quitar.isPending} onClick={() => quitar.mutate(actual.data!.endpoint)}>
            Desactivar
          </Boton>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-300">Recibe un aviso cuando un aparato consuma de más, aunque la app esté cerrada.</p>
          <Boton cargando={activar.isPending} onClick={() => activar.mutate()}>Activar avisos</Boton>
          {errorActivar && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{errorActivar}</p>}
        </>
      )}

      {!!dispositivos.data?.length && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Dispositivos con avisos</p>
          <ul className="space-y-1">
            {dispositivos.data.map((d) => (
              <li key={d.id_suscripcion} className="flex items-center gap-2 text-sm">
                <span className="flex-1">
                  {describirDispositivo(d.user_agent)}
                  {d.endpoint === actual.data?.endpoint && <span className="text-slate-500"> (este)</span>}
                </span>
                <Boton variante="fantasma" className="min-h-8 px-2 text-xs" onClick={() => quitar.mutate(d.endpoint)}>Quitar</Boton>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">Los avisos por correo siempre están activos.</p>
    </Tarjeta>
  );
}

function SeccionTarifa() {
  const tarifa = useTarifa();
  return (
    <Tarjeta>
      <h2 className="mb-3 font-semibold">Tarifa eléctrica</h2>
      {tarifa.data ? <FormTarifa key={tarifa.data.tarifa} inicial={tarifa.data.tarifa} /> : <p className="text-sm text-slate-500">Cargando…</p>}
    </Tarjeta>
  );
}

function FormTarifa({ inicial }: { inicial: number }) {
  const usuario = useUsuario();
  const guardar = useGuardarTarifa();
  const avisar = useAviso();
  const [valor, setValor] = useState(String(inicial).replace(".", ","));

  function enviar(e: FormEvent) {
    e.preventDefault();
    const n = Number(valor.replace(",", "."));
    if (!(n > 0 && n < 100)) return avisar("Escribe un valor entre 0 y 100 Bs/kWh.", "error");
    guardar.mutate(
      { id_usuario: usuario.id, tarifa: n },
      { onSuccess: () => avisar("Tarifa guardada"), onError: (er) => avisar(mensajeError(er), "error") },
    );
  }

  return (
    <form onSubmit={enviar}>
      <Campo
        etiqueta="Precio por kWh (Bs)"
        htmlFor="tarifa"
        ayuda={`Búscalo en tu factura (Bs/kWh). Si no lo cambias se usa ${fmtBs(TARIFA_POR_DEFECTO)}, un valor orientativo.`}
      >
        <div className="flex gap-2">
          <Entrada id="tarifa" inputMode="decimal" className="w-32" value={valor} onChange={(e) => setValor(e.target.value)} />
          <Boton type="submit" cargando={guardar.isPending}>Guardar</Boton>
        </div>
      </Campo>
    </form>
  );
}

function FormClave({ onListo }: { onListo: () => void }) {
  const avisar = useAviso();
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (clave.length < 8) return setError("Usa al menos 8 caracteres.");
    if (clave !== clave2) return setError("Las contraseñas no coinciden.");
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: clave });
    setEnviando(false);
    if (error) return setError(mensajeError(error));
    avisar("Contraseña actualizada");
    onListo();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="Nueva contraseña" htmlFor="nc1">
        <Entrada id="nc1" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
      </Campo>
      <Campo etiqueta="Repítela" htmlFor="nc2" error={error}>
        <Entrada id="nc2" type="password" autoComplete="new-password" value={clave2} onChange={(e) => setClave2(e.target.value)} />
      </Campo>
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={onListo}>Cancelar</Boton>
        <Boton type="submit" cargando={enviando}>Guardar</Boton>
      </div>
    </form>
  );
}
