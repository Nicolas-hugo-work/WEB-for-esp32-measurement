import { useEffect, useRef } from "react";
import uPlot, { type AlignedData, type Options } from "uplot";
import { ZONA } from "../../lib/fechas";
import { fmtNum } from "../../lib/electrica";

/** Colores de la guía de gráficos (serie 1 azul; superficie y texto por modo). */
function paleta() {
  const oscuro = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return oscuro
    ? { serie: "#3987e5", relleno: "rgba(57,135,229,0.12)", texto: "#c3c2b7", grilla: "#2c2c2a", ref: "#f0efec" }
    : { serie: "#2a78d6", relleno: "rgba(42,120,214,0.10)", texto: "#52514e", grilla: "#e7e6e2", ref: "#0b0b0b" };
}

const FMT_SEG = new Intl.DateTimeFormat("es-BO", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const FMT_HORA = new Intl.DateTimeFormat("es-BO", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const FMT_DIA_HORA = new Intl.DateTimeFormat("es-BO", { timeZone: ZONA, day: "numeric", month: "short", hour: "2-digit", hourCycle: "h23" });
const FMT_DIA = new Intl.DateTimeFormat("es-BO", { timeZone: ZONA, day: "numeric", month: "short" });

export interface DatosGrafico {
  /** segundos epoch */
  x: number[];
  y: (number | null)[];
  min?: (number | null)[];
  max?: (number | null)[];
}

export function Grafico({
  datos,
  tipo = "linea",
  umbral,
  unidad = "A",
  etiquetaSerie = "Corriente",
  formatoX = "hora",
  alto = 220,
  descripcion,
  rangoX,
}: {
  datos: DatosGrafico;
  tipo?: "linea" | "barras";
  umbral?: number | null;
  unidad?: string;
  etiquetaSerie?: string;
  formatoX?: "hora" | "dia";
  alto?: number;
  descripcion: string;
  /** Ventana fija del eje X (segundos epoch), p. ej. los últimos 10 min en vivo. */
  rangoX?: [number, number];
}) {
  const caja = useRef<HTMLDivElement>(null);
  const grafico = useRef<uPlot | null>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const c = paleta();
    const conBanda = Boolean(datos.min && datos.max) && tipo === "linea";
    const fmt = (v: number | null) => (v == null ? "—" : `${fmtNum(v, v < 10 ? 2 : 1)} ${unidad}`);

    const series: Options["series"] = [
      {
        label: formatoX === "dia" ? "Día" : "Hora",
        value: (_u, v) =>
          v == null
            ? "—"
            : new Intl.DateTimeFormat("es-BO", {
                timeZone: ZONA,
                ...(formatoX === "dia"
                  ? { weekday: "short", day: "numeric", month: "short" }
                  : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }),
              }).format(new Date(v * 1000)),
      },
      {
        label: etiquetaSerie,
        stroke: c.serie,
        width: 2,
        fill: tipo === "barras" ? c.serie : conBanda ? undefined : c.relleno,
        paths: tipo === "barras" ? uPlot.paths.bars!({ size: [0.6, 24], radius: 0.15 }) : undefined,
        points: { show: false },
        value: (_u, v) => fmt(v),
      },
    ];
    const data: (number | null)[][] = [datos.x, datos.y];
    const bandas: Options["bands"] = [];
    if (conBanda) {
      series.push(
        { label: "Máx", stroke: "transparent", points: { show: false }, value: (_u, v) => fmt(v) },
        { label: "Mín", stroke: "transparent", points: { show: false }, value: (_u, v) => fmt(v) },
      );
      data.push(datos.max!, datos.min!);
      bandas.push({ series: [2, 3], fill: c.relleno });
    }
    const eje = { stroke: c.texto, grid: { stroke: c.grilla, width: 1 }, ticks: { stroke: c.grilla, width: 1 } };
    const opciones: Options = {
      width: el.clientWidth,
      height: alto,
      series,
      bands: bandas,
      tzDate: (ts) => uPlot.tzDate(new Date(ts * 1e3), ZONA),
      fmtDate: (tpl) => uPlot.fmtDate(tpl, {
        MMMM: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
        MMM: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
        WWWW: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
        WWW: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
      }),
      cursor: { drag: { x: false, y: false }, points: { size: 8 } },
      // Línea de referencia del límite, de borde a borde y con su rótulo (no es una serie).
      hooks: {
        draw: [
          (u) => {
            if (umbral == null) return;
            const y = u.valToPos(umbral, "y", true);
            const { left, width, top } = u.bbox;
            if (y < top) return;
            const ctx = u.ctx;
            const pr = devicePixelRatio || 1;
            ctx.save();
            ctx.strokeStyle = c.ref;
            ctx.lineWidth = 1.5 * pr;
            ctx.setLineDash([6 * pr, 4 * pr]);
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(left + width, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = c.ref;
            ctx.font = `${12 * pr}px system-ui, sans-serif`;
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            ctx.fillText(`Límite ${fmt(umbral)}`, left + 4 * pr, y - 3 * pr);
            ctx.restore();
          },
        ],
      },
      legend: { live: true },
      scales: {
        x: { time: true, ...(rangoX ? { range: () => rangoX } : {}) },
        y: { range: (_u, _min, max) => [0, Math.max(max ?? 0, umbral ?? 0, 0.1) * 1.15] },
      },
      axes: [
        {
          ...eje,
          space: 64,
          // Etiquetas del eje en español y 24 h, en hora de La Paz.
          values: (u, valores) => {
            const rango = (u.scales.x.max ?? 0) - (u.scales.x.min ?? 0);
            const f =
              formatoX === "dia" || rango > 3 * 86_400 ? FMT_DIA : rango > 86_400 ? FMT_DIA_HORA : rango < 300 ? FMT_SEG : FMT_HORA;
            return valores.map((v) => f.format(new Date(v * 1000)));
          },
        },
        { ...eje, size: 48, values: (_u, vals) => vals.map((v) => fmtNum(v, v < 10 ? 1 : 0)) },
      ],
    };
    grafico.current?.destroy();
    grafico.current = new uPlot(opciones, data as AlignedData, el);

    const ro = new ResizeObserver(() => grafico.current?.setSize({ width: el.clientWidth, height: alto }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      grafico.current?.destroy();
      grafico.current = null;
    };
  }, [datos, tipo, umbral, unidad, etiquetaSerie, formatoX, alto, rangoX]);

  return <div ref={caja} role="img" aria-label={descripcion} className="w-full" />;
}
