/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { clientsClaim } from "workbox-core";
import { opcionesNotificacion, urlSegura, type PayloadPush } from "./features/push/payload";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// La app (SPA) abre aunque no haya internet. Las llamadas a Supabase nunca se cachean.
try {
  registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html"), { denylist: [/^\/supabase\//] }));
} catch {
  // En desarrollo index.html no está en el precache.
}

function leerPayload(datos: PushMessageData | null): PayloadPush | null {
  try {
    return datos?.json() ?? null;
  } catch {
    return { body: datos?.text() };
  }
}

self.addEventListener("push", (event) => {
  const { titulo, opciones } = opcionesNotificacion(leerPayload(event.data));
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(titulo, opciones);
      // Las pestañas abiertas actualizan la insignia de alertas.
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const v of ventanas) v.postMessage({ tipo: "push-recibido" });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = urlSegura((event.notification.data as { url?: string } | null)?.url);
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const v of ventanas) {
        if (new URL(v.url).origin === self.location.origin) {
          await v.focus();
          v.postMessage({ tipo: "navegar", url });
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
