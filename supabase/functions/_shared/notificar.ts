// Cliente admin de Supabase + envío de alertas por correo (Resend) y push (Web Push).
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildPushHTTPRequest } from "npm:@pushforge/builder@2.0.4";

export const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export interface AlertaInfo {
  id_alerta: number;
  id_medidor?: number;
  id_usuario: string;
  alias: string | null;
  corriente_a: number;
  umbral_a: number;
}

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function notificarAlerta(a: AlertaInfo): Promise<void> {
  const nombre = a.alias?.trim() || "Tu aparato";
  const titulo = `Alerta: ${nombre} está consumiendo de más`;
  const texto = `Corriente ${Number(a.corriente_a).toFixed(2)} A (límite ${Number(a.umbral_a).toFixed(2)} A) durante varios segundos seguidos.`;
  await Promise.allSettled([
    enviarCorreo(a.id_usuario, titulo, texto, nombre),
    enviarPush(a.id_usuario, titulo, texto, a.id_alerta, a.id_medidor),
  ]);
}

async function enviarCorreo(idUsuario: string, titulo: string, texto: string, nombre: string) {
  const clave = Deno.env.get("RESEND_API_KEY");
  if (!clave) {
    console.warn("RESEND_API_KEY no configurada: no se envía correo");
    return;
  }
  const { data, error } = await admin.auth.admin.getUserById(idUsuario);
  const email = data?.user?.email;
  if (error || !email) {
    console.error("No pude obtener el correo del usuario", error);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("EMAIL_FROM") ?? "Medidor <onboarding@resend.dev>",
      to: [email],
      subject: titulo,
      html: `<p><strong>${escapar(nombre)}</strong></p><p>${escapar(texto)}</p>` +
        `<p>Revisa el aparato. Si es normal, puedes subir su límite en la web.</p>`,
    }),
  });
  if (!res.ok) console.error("Resend respondió", res.status, await res.text());
}

async function enviarPush(
  idUsuario: string,
  titulo: string,
  texto: string,
  idAlerta: number,
  idMedidor?: number,
) {
  const jwk = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!jwk) {
    console.warn("VAPID_PRIVATE_KEY no configurada: no se envía push");
    return;
  }
  const { data: subs, error } = await admin
    .from("push_suscripciones")
    .select("id_suscripcion, endpoint, p256dh, auth")
    .eq("id_usuario", idUsuario);
  if (error || !subs?.length) return;

  const privateJWK = JSON.parse(jwk);
  const adminContact = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

  await Promise.allSettled(subs.map(async (s) => {
    try {
      const { endpoint, headers, body } = await buildPushHTTPRequest({
        privateJWK,
        subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        message: {
          payload: {
            title: titulo,
            body: texto,
            tag: `alerta-${idAlerta}`,
            // La web abre esta ruta al tocar la notificación.
            url: idMedidor ? `/medidor/${idMedidor}` : "/alertas",
          },
          adminContact,
          options: { ttl: 3600, urgency: "high" },
        },
      });
      const res = await fetch(endpoint, { method: "POST", headers, body });
      if (res.status === 404 || res.status === 410) {
        // El navegador ya no acepta esa suscripción: se borra.
        await admin.from("push_suscripciones").delete().eq("id_suscripcion", s.id_suscripcion);
      } else if (!res.ok) {
        console.error("Push respondió", res.status, await res.text());
      }
    } catch (e) {
      console.error("Error enviando push", e);
    }
  }));
}
