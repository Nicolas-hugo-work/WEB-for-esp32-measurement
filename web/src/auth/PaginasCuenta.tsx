import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import { mensajeError } from "../lib/errores";
import { Boton, Campo, Entrada } from "../components/ui";
import { IcoRayo } from "../components/Iconos";
import { useAuth } from "./contexto";

function MarcoCuenta({ titulo, children, pie }: { titulo: string; children: ReactNode; pie?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-slate-900 text-amber-500 dark:bg-slate-800">
          <IcoRayo className="size-7" />
        </span>
        <div>
          <p className="text-xl font-bold">Mi Consumo</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cuánto gasta cada aparato</p>
        </div>
      </div>
      <h1 className="mb-4 text-lg font-semibold">{titulo}</h1>
      {children}
      {pie && <div className="mt-6 space-y-2 text-center text-sm">{pie}</div>}
    </main>
  );
}

const enlace = "font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-400";
const MIN_CLAVE = 8;

function MensajeError({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
      {texto}
    </p>
  );
}

function CampoClave({ id, valor, onCambio, etiqueta = "Contraseña", autoComplete }: {
  id: string; valor: string; onCambio: (v: string) => void; etiqueta?: string; autoComplete: string;
}) {
  const [ver, setVer] = useState(false);
  return (
    <Campo etiqueta={etiqueta} htmlFor={id}>
      <div className="relative">
        <Entrada
          id={id}
          type={ver ? "text" : "password"}
          required
          minLength={autoComplete === "new-password" ? MIN_CLAVE : undefined}
          autoComplete={autoComplete}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          className="pr-20"
        />
        <button
          type="button"
          onClick={() => setVer(!ver)}
          className="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2 text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          {ver ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </Campo>
  );
}

export function Ingresar() {
  const { sesion } = useAuth();
  const navegar = useNavigate();
  const desde = (useLocation().state as { desde?: string } | null)?.desde ?? "/";
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (sesion) return <Navigate to={desde} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
    setEnviando(false);
    if (error) setError(mensajeError(error));
    else navegar(desde, { replace: true });
  }

  return (
    <MarcoCuenta
      titulo="Ingresar"
      pie={
        <>
          <p><Link className={enlace} to="/recuperar">¿Olvidaste tu contraseña?</Link></p>
          <p>¿No tienes cuenta? <Link className={enlace} to="/registro">Regístrate</Link></p>
        </>
      }
    >
      <form onSubmit={enviar} className="space-y-4">
        <Campo etiqueta="Correo" htmlFor="correo">
          <Entrada id="correo" type="email" required autoComplete="email" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </Campo>
        <CampoClave id="clave" valor={clave} onCambio={setClave} autoComplete="current-password" />
        <MensajeError texto={error} />
        <Boton type="submit" bloque cargando={enviando}>Ingresar</Boton>
      </form>
    </MarcoCuenta>
  );
}

export function Registro() {
  const { sesion } = useAuth();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [revisarCorreo, setRevisarCorreo] = useState(false);

  if (sesion) return <Navigate to="/" replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (clave.length < MIN_CLAVE) return setError(`La contraseña debe tener al menos ${MIN_CLAVE} caracteres.`);
    if (clave !== clave2) return setError("Las contraseñas no coinciden.");
    setEnviando(true);
    const { data, error } = await supabase.auth.signUp({
      email: correo.trim(),
      password: clave,
      options: { emailRedirectTo: window.location.origin + "/" },
    });
    setEnviando(false);
    if (error) return setError(mensajeError(error));
    // Si la confirmación de correo está activa no hay sesión todavía.
    if (!data.session) setRevisarCorreo(true);
  }

  if (revisarCorreo) {
    return (
      <MarcoCuenta titulo="Revisa tu correo" pie={<Link className={enlace} to="/ingresar">Volver a ingresar</Link>}>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Te enviamos un enlace a <strong>{correo}</strong> para confirmar tu cuenta. Ábrelo desde este dispositivo.
        </p>
      </MarcoCuenta>
    );
  }

  return (
    <MarcoCuenta titulo="Crear cuenta" pie={<p>¿Ya tienes cuenta? <Link className={enlace} to="/ingresar">Ingresa</Link></p>}>
      <form onSubmit={enviar} className="space-y-4">
        <Campo etiqueta="Correo" htmlFor="correo">
          <Entrada id="correo" type="email" required autoComplete="email" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </Campo>
        <CampoClave id="clave" valor={clave} onCambio={setClave} autoComplete="new-password" />
        <CampoClave id="clave2" etiqueta="Repite la contraseña" valor={clave2} onCambio={setClave2} autoComplete="new-password" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Mínimo {MIN_CLAVE} caracteres.</p>
        <MensajeError texto={error} />
        <Boton type="submit" bloque cargando={enviando}>Crear cuenta</Boton>
      </form>
    </MarcoCuenta>
  );
}

export function Recuperar() {
  const [correo, setCorreo] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(correo.trim(), {
      redirectTo: window.location.origin + "/restablecer",
    });
    setEnviando(false);
    // Solo mostramos errores de límite o de red: nunca revelamos si el correo existe.
    if (error && /rate|fetch|network/i.test(error.message)) return setError(mensajeError(error));
    setEnviado(true);
  }

  return (
    <MarcoCuenta titulo="Recuperar contraseña" pie={<Link className={enlace} to="/ingresar">Volver a ingresar</Link>}>
      {enviado ? (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
          Si existe una cuenta con <strong>{correo}</strong>, te llegará un enlace para crear una contraseña nueva.
        </p>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <Campo etiqueta="Correo" htmlFor="correo">
            <Entrada id="correo" type="email" required autoComplete="email" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </Campo>
          <MensajeError texto={error} />
          <Boton type="submit" bloque cargando={enviando}>Enviar enlace</Boton>
        </form>
      )}
    </MarcoCuenta>
  );
}

export function Restablecer() {
  const { sesion, cargando } = useAuth();
  const navegar = useNavigate();
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (cargando) return null;
  if (!sesion) {
    return (
      <MarcoCuenta titulo="Enlace no válido" pie={<Link className={enlace} to="/recuperar">Pedir otro enlace</Link>}>
        <p className="text-sm text-slate-600 dark:text-slate-300">El enlace venció o ya se usó.</p>
      </MarcoCuenta>
    );
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (clave.length < MIN_CLAVE) return setError(`La contraseña debe tener al menos ${MIN_CLAVE} caracteres.`);
    if (clave !== clave2) return setError("Las contraseñas no coinciden.");
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: clave });
    setEnviando(false);
    if (error) return setError(mensajeError(error));
    navegar("/", { replace: true });
  }

  return (
    <MarcoCuenta titulo="Nueva contraseña">
      <form onSubmit={enviar} className="space-y-4">
        <CampoClave id="clave" etiqueta="Nueva contraseña" valor={clave} onCambio={setClave} autoComplete="new-password" />
        <CampoClave id="clave2" etiqueta="Repítela" valor={clave2} onCambio={setClave2} autoComplete="new-password" />
        <MensajeError texto={error} />
        <Boton type="submit" bloque cargando={enviando}>Guardar</Boton>
      </form>
    </MarcoCuenta>
  );
}
