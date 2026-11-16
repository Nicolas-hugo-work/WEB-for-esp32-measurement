// Prueba de integración contra Supabase LOCAL (npx supabase start + functions serve).
// Usa la publishable key como el navegador; la clave service_role solo se usa aquí
// para preparar datos (hacer admin a un usuario), nunca en la web.
//
//   node scripts/prueba-integracion.mjs
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const st = Object.fromEntries(
  execSync("npx supabase status -o env", { cwd: "..", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n")
    .map((l) => l.match(/^(\w+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const URL = st.API_URL;
const PUB = st.PUBLISHABLE_KEY ?? st.ANON_KEY;
const FN = `${URL}/functions/v1`;
const admin = createClient(URL, st.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let fallos = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallos++;
};

async function usuarioNuevo() {
  const c = createClient(URL, PUB, { auth: { persistSession: false } });
  const email = `prueba-${randomBytes(4).toString("hex")}@ejemplo.test`;
  const { data, error } = await c.auth.signUp({ email, password: "clave-segura-123" });
  if (error) throw error;
  return { c, id: data.user.id, email };
}

const post = async (ruta, cuerpo, token) => {
  const r = await fetch(`${FN}/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { "x-device-token": token } : {}) },
    body: JSON.stringify(cuerpo),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};
// `desde` = segundos atrás de la lectura más nueva (lotes que no se pisan, como el ESP32 real).
const lote = (amperios, n = 15, desde = 0) => Array.from({ length: n }, (_, i) => ({ dt: desde + n - 1 - i, a: amperios }));

const A = await usuarioNuevo();
const B = await usuarioNuevo();
console.log(`Usuarios: A=${A.email} B=${B.email}`);

// --- catálogo y ubicación
const { data: cat } = await A.c.from("catalogo_aparatos").select("id_catalogo, tipo, corriente_nominal_a").eq("tipo", "Refrigerador").single();
ok(cat?.corriente_nominal_a == 0.682, "Catálogo general visible (Refrigerador 0,682 A)");
const { data: ubic, error: eUb } = await A.c.from("ubicaciones").insert({ nombre: "Cocina", id_usuario: A.id }).select().single();
ok(!eUb, "A crea ubicación");
const dup = await A.c.from("ubicaciones").insert({ nombre: "Cocina", id_usuario: A.id });
ok(dup.error?.code === "23505", "Ubicación duplicada → 23505");

// --- vinculación
const { data: cod, error: eCod } = await A.c.rpc("generar_codigo_vinculacion", { p_id_catalogo: cat.id_catalogo, p_id_ubicacion: ubic.id_ubicacion, p_alias: "Refri prueba" });
ok(!eCod && /^[2-9A-HJKMNP-Z]{8}$/.test(cod?.[0]?.codigo_generado), `Código generado ${cod?.[0]?.codigo_generado}`);
const codigo = cod[0].codigo_generado;
const malo = await post("vincular-dispositivo", { codigo: "ZZZZZZZZ", mac: "aa:bb:cc:dd:ee:ff", firmware: "t" });
ok(malo.status === 400, "Código inválido → 400");
const mac = Array.from(randomBytes(6), (b) => b.toString(16).padStart(2, "0")).join(":");
const v = await post("vincular-dispositivo", { codigo: codigo.slice(0, 4) + "-" + codigo.slice(4).toLowerCase(), mac, firmware: "t" });
ok(v.status === 200 && v.json?.token, "ESP32 canjea el código (con guion y minúsculas)");
const { token, id_medidor } = v.json;
const reuso = await post("vincular-dispositivo", { codigo, mac, firmware: "t" });
ok(reuso.status === 400, "El código es de un solo uso");
const { data: estado } = await A.c.from("codigos_vinculacion").select("usado_en, id_medidor").eq("codigo", codigo).maybeSingle();
ok(estado?.usado_en && estado.id_medidor === id_medidor, "La web detecta la vinculación (usado_en, id_medidor)");

// --- ingesta y lectura
const ing = await post("ingest", { fw: "t", lecturas: lote(0.5, 15, 60) }, token);
ok(ing.status === 200 && ing.json?.insertadas === 15, "Ingest inserta 15 lecturas");
const { data: ul } = await A.c.from("ultima_lectura").select("*").in("id_medidor", [id_medidor]);
ok(ul?.length === 1 && Number(ul[0].corriente_a) === 0.5, "ultima_lectura (nueva vista) devuelve la última");
const ahora = Date.now();
const { data: serie, error: eSerie } = await A.c.rpc("lecturas_serie", {
  p_id_medidor: id_medidor, p_desde: new Date(ahora - 3600e3).toISOString(), p_hasta: new Date(ahora + 60e3).toISOString(), p_seg: 3600,
});
ok(!eSerie && serie?.length >= 1 && serie.reduce((s, x) => s + x.muestras, 0) === 15, "lecturas_serie agrega (15 muestras)");
const { data: serieB } = await B.c.rpc("lecturas_serie", {
  p_id_medidor: id_medidor, p_desde: new Date(ahora - 3600e3).toISOString(), p_hasta: new Date(ahora + 60e3).toISOString(), p_seg: 60,
});
ok(serieB?.length === 0, "lecturas_serie respeta RLS (B no ve datos de A)");

// --- aislamiento entre usuarios (RLS)
const { data: medB } = await B.c.from("medidores_esp32").select("id_medidor");
ok(medB?.length === 0, "B no ve los medidores de A");
const { data: codB } = await B.c.from("codigos_vinculacion").select("codigo");
ok(codB?.length === 0, "B no ve los códigos de A");
const updB = await B.c.from("medidores_esp32").update({ nombre: "hackeado" }).eq("id_medidor", id_medidor).select();
ok(updB.data?.length === 0, "B no puede renombrar el medidor de A");
const mac2 = await A.c.from("medidores_esp32").update({ mac_address: "00:00:00:00:00:01" }).eq("id_medidor", id_medidor);
ok(mac2.error?.code === "42501", "A no puede cambiar la MAC (sin GRANT de columna)");
const insL = await A.c.from("lecturas_energia").insert({ id_medidor, corriente_a: 1 });
ok(Boolean(insL.error), "El navegador no puede insertar lecturas");

// --- nombre único (P4) y alertas
const { data: ap } = await A.c.from("aparatos_instalados").select("id_aparato, alias").eq("id_medidor", id_medidor).single();
ok(ap.alias === "Refri prueba", "El alias del código llega al aparato");
const cfg = await A.c.from("aparatos_instalados").update({ umbral_corriente_a: 0.8, segundos_sostenido: 10 }).eq("id_aparato", ap.id_aparato).select();
ok(cfg.data?.length === 1, "A configura la alerta (umbral 0,8 A, 10 s)");
const sobre = await post("ingest", { fw: "t", lecturas: lote(2.0) }, token);
ok(sobre.status === 200 && sobre.json?.insertadas === 15, "Ingest con sobreconsumo (15 lecturas a 2 A)");
const { data: alertas } = await A.c.from("alertas").select("id_alerta, leida, umbral_a").eq("id_medidor", id_medidor);
ok(alertas?.length === 1 && Number(alertas[0].umbral_a) === 0.8, "Se crea 1 alerta con el umbral configurado");
const { count } = await A.c.from("alertas").select("id_alerta", { count: "exact", head: true }).eq("leida", false);
ok(count === 1, "Contador de no leídas = 1");
const marcarB = await B.c.from("alertas").update({ leida: true }).eq("leida", false).select();
ok(marcarB.data?.length === 0, "B no puede marcar alertas de A");
const marcar = await A.c.from("alertas").update({ leida: true }).eq("leida", false).select();
ok(marcar.data?.length === 1, "A marca todas como leídas");

// --- fallas
const f = await post("ingest", { fw: "t", lecturas: [], falla: { codigo: "CERO_FALLIDO", bias_v: 1.6 } }, token);
const { data: fallas } = await A.c.from("fallas_hardware").select("codigo").eq("id_medidor", id_medidor);
ok(f.status === 200 && fallas?.[0]?.codigo === "CERO_FALLIDO", "Falla registrada y visible");

// --- catálogo propio, administrador y tarifa
const propio = await A.c.from("catalogo_aparatos").insert({ id_usuario: A.id, tipo: "Hervidor", potencia_nominal_w: 2000 }).select().single();
ok(!propio.error, "A crea un aparato propio");
const { data: catB } = await B.c.from("catalogo_aparatos").select("id_catalogo").eq("id_catalogo", propio.data.id_catalogo);
ok(catB?.length === 0, "B no ve el aparato propio de A");
const globalNo = await A.c.from("catalogo_aparatos").insert({ id_usuario: null, tipo: "Global", potencia_nominal_w: 10 });
ok(Boolean(globalNo.error), "Un usuario normal no crea aparatos generales");
const { data: esAdmin0 } = await A.c.rpc("es_admin");
ok(esAdmin0 === false, "es_admin() = false para un usuario normal");
await admin.from("administradores").insert({ id_usuario: A.id });
const { data: esAdmin1 } = await A.c.rpc("es_admin");
ok(esAdmin1 === true, "es_admin() = true tras asignarlo");
const globalSi = await A.c.from("catalogo_aparatos").insert({ id_usuario: null, tipo: "Prueba global", potencia_nominal_w: 10 }).select().single();
ok(!globalSi.error, "El administrador crea un aparato general");
const { data: vistoB } = await B.c.from("catalogo_aparatos").select("id_catalogo").eq("id_catalogo", globalSi.data?.id_catalogo);
ok(vistoB?.length === 1, "B ve el aparato general nuevo");
const editB = await B.c.from("catalogo_aparatos").update({ tipo: "x" }).eq("id_catalogo", globalSi.data?.id_catalogo).select();
ok(editB.data?.length === 0, "B no edita aparatos generales");
await A.c.from("catalogo_aparatos").delete().eq("id_catalogo", globalSi.data?.id_catalogo);
const enUso = await A.c.from("catalogo_aparatos").delete().eq("id_catalogo", cat.id_catalogo);
ok(enUso.error?.code === "23503", "Borrar un aparato en uso → 23503");
await admin.from("administradores").delete().eq("id_usuario", A.id);

const tarifa = await A.c.from("ajustes_usuario").upsert({ id_usuario: A.id, tarifa_bs_kwh: 0.75 }, { onConflict: "id_usuario" });
const { data: t } = await A.c.from("ajustes_usuario").select("tarifa_bs_kwh").maybeSingle();
ok(!tarifa.error && Number(t?.tarifa_bs_kwh) === 0.75, "Tarifa guardada (0,75 Bs/kWh)");
const { data: tB } = await B.c.from("ajustes_usuario").select("tarifa_bs_kwh").maybeSingle();
ok(tB === null, "B no ve la tarifa de A");

// --- push
const sub = await A.c.from("push_suscripciones").insert({ id_usuario: A.id, endpoint: "https://push.ejemplo/" + randomBytes(4).toString("hex"), p256dh: "x", auth: "y" }).select().single();
ok(!sub.error, "A guarda una suscripción push");
const robar = await B.c.from("push_suscripciones").upsert({ id_usuario: B.id, endpoint: sub.data.endpoint, p256dh: "x", auth: "y" }, { onConflict: "endpoint" });
ok(Boolean(robar.error), "Mismo endpoint con otra cuenta → error (la web se vuelve a suscribir)");

// --- recalibrar el cero desde la web
const recalB = await B.c.from("medidores_esp32").update({ recalibrar_solicitado: true }).eq("id_medidor", id_medidor).select();
ok(recalB.data?.length === 0, "B no puede pedir recalibrar el medidor de A");
const recal = await A.c.from("medidores_esp32").update({ recalibrar_solicitado: true }).eq("id_medidor", id_medidor).select("recalibrar_solicitado");
ok(recal.data?.[0]?.recalibrar_solicitado === true, "A pide recalibrar el cero");
const r1 = await post("ingest", { fw: "t", lecturas: lote(0.1, 15, 120) }, token);
ok(r1.status === 200 && r1.json?.recalibrar === true, "ingest entrega {recalibrar: true} al ESP32");
const r2 = await post("ingest", { fw: "t", lecturas: lote(0.1, 15, 140) }, token);
ok(r2.status === 200 && r2.json?.recalibrar === false, "…solo una vez (el siguiente envío ya no lo pide)");
const { data: flag } = await A.c.from("medidores_esp32").select("recalibrar_solicitado").eq("id_medidor", id_medidor).single();
ok(flag?.recalibrar_solicitado === false, "La marca se limpia en la base");

// --- desvincular y eliminar
await A.c.from("medidores_esp32").update({ activo: false }).eq("id_medidor", id_medidor);
const tras = await post("ingest", { fw: "t", lecturas: lote(0.5) }, token);
ok(tras.status === 401, "Desvinculado → ingest 401 (el ESP32 borra su token)");
const del = await A.c.from("medidores_esp32").delete().eq("id_medidor", id_medidor).select();
ok(del.data?.length === 1, "A elimina el medidor");
const { count: quedan } = await admin.from("lecturas_energia").select("*", { count: "exact", head: true }).eq("id_medidor", id_medidor);
ok(quedan === 0, "Las lecturas se borran en cascada");

// limpieza
await admin.auth.admin.deleteUser(A.id);
await admin.auth.admin.deleteUser(B.id);
console.log(fallos ? `\n✗ ${fallos} fallos` : "\n✓ Todo OK");
process.exit(fallos ? 1 : 0);
