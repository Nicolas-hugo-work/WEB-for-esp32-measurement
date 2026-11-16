import { supabase } from "../../lib/supabase";
import { env } from "../../lib/env";

export const pushSoportado = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export const esIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const esPWAInstalada = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function claveServidor(base64url: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function registro() {
  return navigator.serviceWorker.ready;
}

/** El servicio de push del navegador (FCM, APNs…) a veces no responde: no dejar la UI colgada. */
function conLimite<T>(p: Promise<T>, ms = 30_000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("push_sin_respuesta")), ms))]);
}

export async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!pushSoportado()) return null;
  const reg = await registro();
  return reg.pushManager.getSubscription();
}

async function guardar(sub: PushSubscription, idUsuario: string) {
  const j = sub.toJSON();
  return supabase.from("push_suscripciones").upsert(
    {
      id_usuario: idUsuario,
      endpoint: sub.endpoint,
      p256dh: j.keys?.p256dh ?? "",
      auth: j.keys?.auth ?? "",
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: "endpoint" },
  );
}

/** Pide permiso (tiene que llamarse desde un toque del usuario) y guarda la suscripción. */
export async function activarPush(idUsuario: string): Promise<void> {
  if (!pushSoportado()) throw new Error("no_soportado");
  if (!env.vapidPublica) throw new Error("sin_vapid");
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") throw new Error("permiso_denegado");
  const reg = await registro();
  const opciones = { userVisibleOnly: true, applicationServerKey: claveServidor(env.vapidPublica) };
  let sub = (await reg.pushManager.getSubscription()) ?? (await conLimite(reg.pushManager.subscribe(opciones)));
  let r = await guardar(sub, idUsuario);
  if (r.error) {
    // El endpoint quedó guardado por otra cuenta en este navegador: se crea uno nuevo.
    await sub.unsubscribe();
    sub = await conLimite(reg.pushManager.subscribe(opciones));
    r = await guardar(sub, idUsuario);
    if (r.error) throw r.error;
  }
}

/** Quita la suscripción de este navegador (al desactivar o al cerrar sesión). */
export async function desactivarPush(): Promise<void> {
  const sub = await suscripcionActual().catch(() => null);
  if (!sub) return;
  await supabase.from("push_suscripciones").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe().catch(() => {});
}

export function describirDispositivo(ua: string | null): string {
  if (!ua) return "Dispositivo";
  const so = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Otro";
  const nav = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return `${nav} en ${so}`;
}
