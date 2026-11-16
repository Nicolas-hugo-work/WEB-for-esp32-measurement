import { defineConfig, devices } from "@playwright/test";

// E2E contra el stack LOCAL: `npx supabase start`, `npm run functions` (raíz) y `npm run dev`.
// Usa el Chrome instalado (no descarga navegadores).
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Pixel 7"],
    channel: "chrome",
    baseURL: process.env.E2E_URL ?? "http://localhost:5173",
    locale: "es-BO",
    timezoneId: "America/La_Paz",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
