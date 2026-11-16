#!/usr/bin/env node
// Simula un ESP32 contra las Edge Functions (por defecto, las locales).
//
//   node scripts/simular-esp32.mjs vincular ABCD-2345        canjea el código de la web
//   node scripts/simular-esp32.mjs enviar 0.7                 1 lote cada 15 s (~0,7 A con ruido)
//   node scripts/simular-esp32.mjs enviar 0.7 --pico 5 --cada 120   cada 2 min, 40 s a 5 A (dispara alerta)
//   node scripts/simular-esp32.mjs falla CERO_FALLIDO         reporta una falla (sin lecturas)
//   node scripts/simular-esp32.mjs historial 3                carga 3 días de lecturas (1 por minuto; ver nota)
//
// Variables: FUNCTIONS_URL (def. http://127.0.0.1:54321/functions/v1), SIM_ARCHIVO (def. scripts/.simulador.json)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const URL_FN = process.env.FUNCTIONS_URL ?? "http://127.0.0.1:54321/functions/v1";
const ARCHIVO = process.env.SIM_ARCHIVO ?? new URL("./.simulador.json", import.meta.url);
const FW = "sim-1.0";

const estado = () => (existsSync(ARCHIVO) ? JSON.parse(readFileSync(ARCHIVO, "utf8")) : {});
const guardar = (e) => writeFileSync(ARCHIVO, JSON.stringify(e, null, 2));
const arg = (nombre, def) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? Number(process.argv[i + 1]) : def;
};

async function post(ruta, cuerpo, token) {
  const r = await fetch(`${URL_FN}/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { "x-device-token": token } : {}) },
    body: JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  return { status: r.status, json: (() => { try { return JSON.parse(texto); } catch { return texto; } })() };
}

async function vincular(codigo) {
  const e = estado();
  const mac = e.mac ?? Array.from(randomBytes(6), (b) => b.toString(16).padStart(2, "0")).join(":");
  const r = await post("vincular-dispositivo", { codigo, mac, firmware: FW });
  if (r.status !== 200) {
    console.error("✗ Vinculación rechazada:", r.status, r.json);
    process.exit(1);
  }
  guardar({ mac, token: r.json.token, id_medidor: r.json.id_medidor });
  console.log(`✓ Vinculado como medidor ${r.json.id_medidor} (MAC ${mac}). Token guardado en ${ARCHIVO}`);
}

function token() {
  const t = estado().token;
  if (!t) {
    console.error("✗ Primero vincula: node scripts/simular-esp32.mjs vincular CODIGO");
    process.exit(1);
  }
  return t;
}

async function enviarLote(lecturas, falla) {
  const r = await post("ingest", { fw: FW, lecturas, ...(falla ? { falla } : {}) }, token());
  if (r.status === 401) {
    console.log("✗ 401: el medidor fue desvinculado o eliminado. Como el ESP32 real, borro el token.");
    const e = estado();
    delete e.token;
    guardar(e);
    process.exit(2);
  }
  return r;
}

async function enviar(base) {
  const pico = arg("pico", null);
  const cada = arg("cada", 120);
  const dur = arg("duracion", 40);
  const t0 = Date.now();
  console.log(`Enviando ~${base} A cada 15 s${pico ? `, con picos de ${pico} A (${dur} s cada ${cada} s)` : ""}. Ctrl+C para parar.`);
  for (;;) {
    const lecturas = [];
    for (let i = 14; i >= 0; i--) {
      const s = (Date.now() - t0) / 1000 - i;
      const enPico = pico != null && s % cada < dur;
      const a = Math.max(0, (enPico ? pico : base) * (1 + (Math.random() - 0.5) * 0.06));
      lecturas.push({ dt: i, a: Math.round(a * 10000) / 10000 });
    }
    const r = await enviarLote(lecturas);
    console.log(new Date().toLocaleTimeString(), r.status, JSON.stringify(r.json));
    await new Promise((res) => setTimeout(res, 15_000));
  }
}

async function falla(codigo) {
  const r = await enviarLote([], { codigo, bias_v: codigo === "REVISAR_DIVISOR" ? 1.12 : 1.65 });
  console.log(r.status, JSON.stringify(r.json));
}

// El firmware solo puede mandar lecturas de hasta 1 h atrás (dt ≤ 3600), así que el
// historial largo se arma "a mano": aquí solo se cargan lotes de la última hora.
async function historial() {
  console.log("Cargando la última hora (dt ≤ 3600 s es el límite de ingest)…");
  for (let desde = 3600; desde > 0; desde -= 120) {
    const lecturas = [];
    for (let dt = desde; dt > desde - 120 && dt >= 0; dt--) {
      const a = 0.5 + 0.3 * Math.sin(dt / 300) + Math.random() * 0.05;
      lecturas.push({ dt, a: Math.round(a * 10000) / 10000 });
    }
    await enviarLote(lecturas);
  }
  console.log("✓ Listo");
}

const [cmd, valor] = process.argv.slice(2);
if (cmd === "vincular" && valor) await vincular(valor);
else if (cmd === "enviar") await enviar(Number(valor ?? 0.7));
else if (cmd === "falla" && valor) await falla(valor);
else if (cmd === "historial") await historial();
else {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 11).join("\n"));
  process.exit(1);
}
