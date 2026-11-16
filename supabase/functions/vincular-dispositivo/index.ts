// El ESP32 llama aquí UNA vez, desde el portal WiFi, con el código que dio la web.
// Devuelve el token secreto del dispositivo (solo se entrega esta vez).
// Desplegar con verify_jwt = false: la autorización es el código de un solo uso.
import { admin } from "../_shared/notificar.ts";
import { json, pausa, sha256Hex, tokenAleatorioHex } from "../_shared/util.ts";

const RE_CODIGO = /^[2-9A-HJKMNP-Z]{8}$/;
const RE_MAC = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "metodo_no_permitido" }, 405);

  const texto = await req.text();
  if (texto.length > 2048) return json({ error: "cuerpo_muy_grande" }, 413);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(texto);
  } catch {
    return json({ error: "json_invalido" }, 400);
  }

  // Acepta "abcd-efgh", "ABCD EFGH", etc.
  const codigo = String(body.codigo ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const mac = String(body.mac ?? "").toLowerCase();
  const firmware = typeof body.firmware === "string" ? body.firmware.slice(0, 20) : null;

  if (!RE_MAC.test(mac)) return json({ error: "mac_invalida" }, 400);
  if (!RE_CODIGO.test(codigo)) {
    await pausa(500);
    return json({ error: "codigo_invalido_o_vencido" }, 400);
  }

  const token = tokenAleatorioHex(32);
  const { data, error } = await admin.rpc("vincular_medidor", {
    p_codigo: codigo,
    p_mac: mac,
    p_firmware: firmware,
    p_token_hash: await sha256Hex(token),
  });

  if (error) {
    console.error("vincular_medidor", error);
    return json({ error: "error_interno" }, 500);
  }
  if (data === null) {
    await pausa(500); // frena intentos a ciegas
    return json({ error: "codigo_invalido_o_vencido" }, 400);
  }
  return json({ token, id_medidor: data });
});
