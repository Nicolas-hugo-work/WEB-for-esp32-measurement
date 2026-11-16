// El ESP32 manda aquí un lote de lecturas cada ~15 s.
// Cabecera:  x-device-token: <token de 64 hex>
// Cuerpo:    {"fw":"2.0.0","lecturas":[{"dt":12.0,"a":0.4321},...],
//             "falla":{"codigo":"REVISAR_DIVISOR","bias_v":1.23}}
//            dt = segundos transcurridos desde esa lectura hasta el envío
//            (así el ESP32 no necesita reloj/NTP).
// Desplegar con verify_jwt = false: la autorización es el token del dispositivo.
import { admin, type AlertaInfo, notificarAlerta } from "../_shared/notificar.ts";
import { json, sha256Hex } from "../_shared/util.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "metodo_no_permitido" }, 405);

  const token = req.headers.get("x-device-token") ?? "";
  if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: "no_autorizado" }, 401);

  const texto = await req.text();
  if (texto.length > 32_768) return json({ error: "cuerpo_muy_grande" }, 413);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(texto);
  } catch {
    return json({ error: "json_invalido" }, 400);
  }

  const crudas = Array.isArray(body.lecturas) ? body.lecturas : [];
  if (crudas.length > 120) return json({ error: "lote_muy_grande" }, 413);

  const lecturas: { dt: number; a: number }[] = [];
  for (const x of crudas as Record<string, unknown>[]) {
    const dt = x?.dt, a = x?.a;
    if (
      typeof dt === "number" && typeof a === "number" &&
      Number.isFinite(dt) && Number.isFinite(a) &&
      dt >= 0 && dt <= 3600 && a >= 0 && a <= 500
    ) {
      lecturas.push({ dt: Math.round(dt * 10) / 10, a: Math.round(a * 10000) / 10000 });
    }
  }

  let falla: { codigo: string; bias_v: number | null } | null = null;
  const f = body.falla as Record<string, unknown> | undefined;
  if (f && typeof f === "object" && typeof f.codigo === "string") {
    falla = {
      codigo: f.codigo,
      bias_v: typeof f.bias_v === "number" && Number.isFinite(f.bias_v) ? f.bias_v : null,
    };
  }
  const fw = typeof body.fw === "string" ? body.fw.slice(0, 20) : null;

  const { data, error } = await admin.rpc("ingestar_lotes", {
    p_token_hash: await sha256Hex(token),
    p_lecturas: lecturas,
    p_falla: falla,
    p_firmware: fw,
  });
  if (error) {
    console.error("ingestar_lotes", error);
    return json({ error: "error_interno" }, 500);
  }
  if (data?.estado === "no_autorizado") return json({ error: "no_autorizado" }, 401);
  if (data?.estado !== "ok") return json({ error: data?.estado ?? "desconocido" }, 400);

  if (data.alerta) {
    const tarea = notificarAlerta(data.alerta as AlertaInfo).catch((e) =>
      console.error("notificarAlerta", e)
    );
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(tarea);
    else await tarea;
  }
  return json({ ok: true, insertadas: data.insertadas });
});
