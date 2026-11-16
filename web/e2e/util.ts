import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";

const st = Object.fromEntries(
  execSync("npx supabase status -o env", { cwd: "..", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n")
    .map((l) => l.match(/^(\w+)="?(.*?)"?$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => [m[1], m[2]]),
);
export const API = st.API_URL as string;
/** Solo para preparar/verificar datos en las pruebas. Nunca en la web. */
export const SERVICE = st.SERVICE_ROLE_KEY as string;

export async function funcion(ruta: string, cuerpo: unknown, token?: string) {
  const r = await fetch(`${API}/functions/v1/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { "x-device-token": token } : {}) },
    body: JSON.stringify(cuerpo),
  });
  return { status: r.status, json: (await r.json().catch(() => null)) as Record<string, unknown> | null };
}

export const macAleatoria = () => Array.from(randomBytes(6), (b) => b.toString(16).padStart(2, "0")).join(":");
export const lote = (a: number, n = 15) => Array.from({ length: n }, (_, i) => ({ dt: n - 1 - i, a }));

export async function registrar(page: Page) {
  const email = `e2e-${randomBytes(4).toString("hex")}@ejemplo.test`;
  await page.goto("/registro");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-segura-123");
  await page.getByLabel("Repite la contraseña").fill("clave-segura-123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByRole("heading", { name: "Mis medidores" }).waitFor();
  return email;
}
