/** Convierte errores de PostgREST, Postgres, Auth o red en un mensaje en español. */
interface ErrorConCodigo {
  code?: string;
  message?: string;
  status?: number;
  details?: string;
}

const POR_MENSAJE: [RegExp, string][] = [
  [/demasiados codigos activos/i, "Tienes 5 códigos sin usar. Espera a que venzan (15 min) o usa uno pendiente."],
  [/aparato no disponible/i, "Ese aparato ya no está disponible. Elige otro."],
  [/ubicacion no valida/i, "Esa ubicación ya no existe. Elige otra."],
  [/no autenticado/i, "Tu sesión venció. Vuelve a ingresar."],
  [/invalid login credentials/i, "Correo o contraseña incorrectos."],
  [/email not confirmed/i, "Confirma tu correo antes de ingresar (revisa tu bandeja)."],
  [/user already registered/i, "Ya existe una cuenta con ese correo."],
  [/password should be at least|weak password/i, "La contraseña es muy débil: usa al menos 8 caracteres."],
  [/rate limit|too many requests/i, "Demasiados intentos. Espera unos minutos y vuelve a probar."],
  [/new password should be different/i, "La nueva contraseña debe ser distinta de la anterior."],
  [/failed to fetch|networkerror|load failed|network request failed/i, "Sin conexión con el servidor. Revisa tu internet."],
];

const POR_CODIGO: Record<string, string> = {
  "23505": "Ya existe un registro con ese nombre.",
  "23503": "No se puede borrar porque está en uso.",
  "23514": "Algún valor está fuera del rango permitido.",
  "42501": "No tienes permiso para hacer eso.",
  PGRST116: "No se encontró el registro.",
  PGRST301: "Tu sesión venció. Vuelve a ingresar.",
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed: "Confirma tu correo antes de ingresar (revisa tu bandeja).",
  user_already_exists: "Ya existe una cuenta con ese correo.",
  weak_password: "La contraseña es muy débil: usa al menos 8 caracteres.",
  over_email_send_rate_limit: "Se enviaron demasiados correos. Espera unos minutos.",
  over_request_rate_limit: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
  same_password: "La nueva contraseña debe ser distinta de la anterior.",
};

export function mensajeError(e: unknown, porDefecto = "Algo salió mal. Intenta de nuevo."): string {
  if (!e) return porDefecto;
  const err = e as ErrorConCodigo;
  const msg = typeof err.message === "string" ? err.message : String(e);
  for (const [re, texto] of POR_MENSAJE) if (re.test(msg)) return texto;
  if (err.code && POR_CODIGO[err.code]) return POR_CODIGO[err.code];
  return porDefecto;
}

/** Lanza si la respuesta de supabase-js trae error. Para listas, single() y rpc(): sin error, data no es null. */
export function sinError<T>(r: { data: T; error: unknown }): NonNullable<T> {
  if (r.error) throw r.error;
  return r.data as NonNullable<T>;
}

/** Igual que sinError pero para maybeSingle(): null significa "no existe". */
export function talVez<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data;
}
