import { describe, expect, it } from "vitest";
import { formatearCodigo, mmss, segundosRestantes } from "./codigo";
import { costoBs, estadoConexion, fmtBs, fmtKwh, kwh, umbralEfectivo, va } from "./electrica";
import { mensajeError } from "./errores";
import { fallaActiva, infoFalla } from "./fallas";
import { agruparPorDia, claveDia } from "./fechas";
import { opcionesNotificacion, urlSegura } from "../features/push/payload";

describe("codigo", () => {
  it("formatea XXXX-XXXX", () => {
    expect(formatearCodigo("abcd2345")).toBe("ABCD-2345");
    expect(formatearCodigo("ABCD-2345")).toBe("ABCD-2345");
    expect(formatearCodigo("ABC")).toBe("ABC");
  });
  it("cuenta regresiva", () => {
    const ahora = Date.parse("2026-11-16T12:00:00Z");
    expect(segundosRestantes("2026-11-16T12:15:00Z", ahora)).toBe(900);
    expect(segundosRestantes("2026-11-16T11:00:00Z", ahora)).toBe(0);
    expect(mmss(65)).toBe("1:05");
  });
});

describe("electrica", () => {
  it("VA = A × 220", () => expect(va(0.5)).toBe(110));
  it("umbral efectivo igual que en SQL", () => {
    // Refrigerador 150 W / 220 V = 0,682 A (generado en la BD) + 20 %
    expect(umbralEfectivo(null, 0.682, 20)).toBe(0.818);
    expect(umbralEfectivo(2.5, 0.682, 20)).toBe(2.5);
    expect(umbralEfectivo(null, 4.545, 0)).toBe(4.545);
    expect(umbralEfectivo(null, null, 20)).toBeNull();
  });
  it("estado de conexión", () => {
    const ahora = Date.parse("2026-11-16T12:00:00Z");
    expect(estadoConexion("2026-11-16T11:59:30Z", true, ahora)).toBe("en_linea");
    expect(estadoConexion("2026-11-16T11:58:00Z", true, ahora)).toBe("sin_conexion");
    expect(estadoConexion(null, true, ahora)).toBe("nunca");
    expect(estadoConexion("2026-11-16T11:59:59Z", false, ahora)).toBe("desvinculado");
  });
  it("energía y costo", () => {
    // 1 A durante 1 hora completa = 220 Wh
    expect(kwh(1, 3600)).toBeCloseTo(0.22, 6);
    expect(costoBs(10, 0.8)).toBeCloseTo(8, 6);
  });
  it("formatea consumos chicos en Wh y costos mínimos", () => {
    expect(fmtKwh(0.00064)).toBe("0,6 Wh");
    expect(fmtKwh(0.05)).toBe("50 Wh");
    expect(fmtKwh(1.234)).toBe("1,23 kWh");
    expect(fmtBs(0.0005)).toBe("< Bs 0,01");
    expect(fmtBs(0)).toBe("Bs 0,00");
  });
});

describe("fechas (America/La_Paz, UTC-4)", () => {
  it("el día se corta a medianoche de La Paz", () => {
    expect(claveDia("2026-11-16T03:59:00Z")).toBe("2026-11-15");
    expect(claveDia("2026-11-16T04:00:00Z")).toBe("2026-11-16");
  });
  it("agrupa por día con promedio ponderado", () => {
    const dias = agruparPorDia(
      [
        { hora: "2026-11-16T02:00:00Z", corriente_prom: 1, corriente_max: 2, corriente_min: 0, muestras: 3600 },
        { hora: "2026-11-16T04:00:00Z", corriente_prom: 2, corriente_max: 3, corriente_min: 1, muestras: 1800 },
        { hora: "2026-11-16T05:00:00Z", corriente_prom: 0.5, corriente_max: 1, corriente_min: 0.1, muestras: 3600 },
      ],
      kwh,
    );
    expect(dias.map((d) => d.dia)).toEqual(["2026-11-15", "2026-11-16"]);
    expect(dias[1].prom).toBeCloseTo((2 * 1800 + 0.5 * 3600) / 5400, 6);
    expect(dias[1].max).toBe(3);
    expect(dias[1].min).toBe(0.1);
    expect(dias[1].kwh).toBeCloseTo(kwh(2, 1800) + kwh(0.5, 3600), 9);
    expect(dias[1].inicio.toISOString()).toBe("2026-11-16T04:00:00.000Z");
  });
});

describe("errores", () => {
  it("traduce errores de la BD y de Auth", () => {
    expect(mensajeError({ code: "P0001", message: "demasiados codigos activos" })).toMatch(/5 códigos/);
    expect(mensajeError({ code: "23503", message: "violates foreign key" })).toMatch(/en uso/);
    expect(mensajeError({ code: "invalid_credentials", message: "Invalid login credentials" })).toMatch(/incorrectos/);
    expect(mensajeError(new TypeError("Failed to fetch"))).toMatch(/Sin conexión/);
    expect(mensajeError({ message: "???" }, "x")).toBe("x");
  });
});

describe("fallas", () => {
  const ahora = Date.parse("2026-11-16T12:00:00Z");
  it("activa si es reciente y no hubo lecturas después", () => {
    expect(fallaActiva("2026-11-16T11:55:00Z", "2026-11-16T11:50:00Z", ahora)).toBe(true);
    expect(fallaActiva("2026-11-16T11:55:00Z", null, ahora)).toBe(true);
    expect(fallaActiva("2026-11-16T11:55:00Z", "2026-11-16T11:56:00Z", ahora)).toBe(false);
    expect(fallaActiva("2026-11-16T11:40:00Z", null, ahora)).toBe(false);
    expect(fallaActiva(null, null, ahora)).toBe(false);
  });
  it("diccionario cubre los 4 códigos del SQL", () => {
    for (const c of ["REVISAR_DIVISOR", "FUERA_RANGO_ADC", "SIN_CALIBRAR_CERO", "CERO_FALLIDO"]) {
      expect(infoFalla(c).queHacer.length).toBeGreaterThan(10);
    }
  });
});

describe("push", () => {
  it("solo abre rutas del mismo origen", () => {
    expect(urlSegura("/medidor/3")).toBe("/medidor/3");
    expect(urlSegura("//evil.com")).toBe("/");
    expect(urlSegura("https://evil.com")).toBe("/");
    expect(urlSegura(undefined)).toBe("/");
  });
  it("arma la notificación desde el payload del backend", () => {
    const { titulo, opciones } = opcionesNotificacion({ title: "Alerta", body: "b", tag: "alerta-1", url: "/alertas" });
    expect(titulo).toBe("Alerta");
    expect(opciones.tag).toBe("alerta-1");
    expect((opciones.data as { url: string }).url).toBe("/alertas");
    expect(opcionesNotificacion(null).titulo).toBe("Mi Consumo");
  });
});
