/** Payload que envía el backend: { title, body, tag, url }. */
export interface PayloadPush {
  title?: unknown;
  body?: unknown;
  tag?: unknown;
  url?: unknown;
}

/** Solo rutas del mismo origen ("/algo", nunca "//otro-sitio" ni "https://..."). */
export function urlSegura(url: unknown): string {
  return typeof url === "string" && /^\/(?!\/)[\w\-/?=&.%]*$/.test(url) ? url : "/";
}

export function opcionesNotificacion(datos: PayloadPush | null): { titulo: string; opciones: NotificationOptions } {
  const titulo = typeof datos?.title === "string" && datos.title ? datos.title : "Mi Consumo";
  return {
    titulo,
    opciones: {
      body: typeof datos?.body === "string" ? datos.body : "",
      tag: typeof datos?.tag === "string" ? datos.tag : undefined,
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      data: { url: urlSegura(datos?.url) },
    },
  };
}
