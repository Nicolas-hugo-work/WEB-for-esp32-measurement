// Genera los íconos PNG de la PWA (rayo ámbar sobre fondo azul noche) sin dependencias.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const FONDO = [15, 23, 42];
const RAYO = [245, 158, 11];
// Rayo en coordenadas 0..1
const POLIGONO = [
  [0.58, 0.06], [0.22, 0.56], [0.47, 0.56], [0.40, 0.94], [0.78, 0.40], [0.53, 0.40], [0.58, 0.06],
];

function dentro(x, y, pol) {
  let c = false;
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const [xi, yi] = pol[i], [xj, yj] = pol[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function bloque(tipo, datos) {
  const len = Buffer.alloc(4); len.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo), datos]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(tam, { escala = 0.78, redondeo = 0.22 } = {}) {
  const SS = 4; // supermuestreo para bordes suaves
  const filas = [];
  for (let y = 0; y < tam; y++) {
    const fila = Buffer.alloc(1 + tam * 4);
    for (let x = 0; x < tam; x++) {
      let fondo = 0, rayo = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const u = (x + (sx + 0.5) / SS) / tam, v = (y + (sy + 0.5) / SS) / tam;
        // esquina redondeada
        const r = redondeo, cx = Math.min(Math.max(u, r), 1 - r), cy = Math.min(Math.max(v, r), 1 - r);
        if ((u - cx) ** 2 + (v - cy) ** 2 > r * r) continue;
        fondo++;
        const pu = (u - 0.5) / escala + 0.5, pv = (v - 0.5) / escala + 0.5;
        if (dentro(pu, pv, POLIGONO)) rayo++;
      }
      const t = SS * SS, a = fondo / t, k = fondo ? rayo / fondo : 0;
      const o = 1 + x * 4;
      for (let c = 0; c < 3; c++) fila[o + c] = Math.round(FONDO[c] * (1 - k) + RAYO[c] * k);
      fila[o + 3] = Math.round(a * 255);
    }
    filas.push(fila);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0); ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque("IHDR", ihdr),
    bloque("IDAT", deflateSync(Buffer.concat(filas))),
    bloque("IEND", Buffer.alloc(0)),
  ]);
}

writeFileSync("public/icon-192.png", png(192));
writeFileSync("public/icon-512.png", png(512));
writeFileSync("public/apple-touch-icon.png", png(180, { redondeo: 0 })); // iOS redondea solo
writeFileSync("public/icon-maskable-512.png", png(512, { escala: 0.55, redondeo: 0 }));
writeFileSync("public/badge-72.png", png(72));
const pts = POLIGONO.map(([x, y]) => `${(x * 78 + 11).toFixed(1)},${(y * 78 + 11).toFixed(1)}`).join(" ");
writeFileSync(
  "public/favicon.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#0f172a"/><polygon points="${pts}" fill="#f59e0b"/></svg>\n`,
);
console.log("Íconos generados en public/");
