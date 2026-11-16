// Falla si el bundle de producción contiene algo que parezca una clave secreta.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PATRONES = [
  /sb_secret_[A-Za-z0-9_-]{10,}/, // secret key nueva de Supabase
  /"d"\s*:\s*"[A-Za-z0-9_-]{20,}"/, // JWK privado (VAPID)
  /\bre_[A-Za-z0-9]{20,}/, // clave de Resend
];

/** Decodifica cada JWT del texto y avisa si alguno es service_role. */
function jwtServiceRole(texto) {
  for (const [jwt] of texto.matchAll(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try {
      const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
      if (payload.role === "service_role") return true;
    } catch {
      /* no era un JWT */
    }
  }
  return false;
}

const archivos = [];
(function recorrer(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) recorrer(p);
    else if (/\.(js|mjs|html|css|json|webmanifest|map)$/.test(n)) archivos.push(p);
  }
})("dist");

let mal = 0;
for (const f of archivos) {
  const t = readFileSync(f, "utf8");
  for (const re of PATRONES) if (re.test(t)) { console.error(`✗ ${f} coincide con ${re}`); mal++; }
  if (jwtServiceRole(t)) { console.error(`✗ ${f} contiene un JWT service_role`); mal++; }
}
if (mal) process.exit(1);
console.log(`✓ ${archivos.length} archivos revisados: sin secretos.`);
