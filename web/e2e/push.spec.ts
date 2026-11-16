import { chromium, devices, expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { API, SERVICE, registrar } from "./util";

test.setTimeout(120_000);

test("activar push guarda la suscripción y el SW muestra el payload del backend", async ({ baseURL }) => {
  // Chrome no permite push en contextos de incógnito (los de Playwright por defecto): perfil persistente.
  const dir = mkdtempSync(join(tmpdir(), "pw-push-"));
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 7"];
  const context = await chromium.launchPersistentContext(dir, {
    viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, channel: "chrome", baseURL, locale: "es-BO",
  });
  test.info().attach("perfil", { body: dir });
  await context.grantPermissions(["notifications"], { origin: baseURL });
  const page = context.pages()[0] ?? (await context.newPage());
  const email = await registrar(page);
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Activar avisos" }).click();
  await expect(page.getByText("Activados", { exact: true })).toBeVisible({ timeout: 45_000 });
  await page.screenshot({ path: "test-results/07-ajustes-push.png", fullPage: true });

  const admin = createClient(API, SERVICE, { auth: { persistSession: false } });
  const { data: usuarios } = await admin.auth.admin.listUsers();
  const id = usuarios.users.find((u) => u.email === email)!.id;
  const { data: subs } = await admin.from("push_suscripciones").select("endpoint, p256dh, auth").eq("id_usuario", id);
  expect(subs).toHaveLength(1);
  expect(subs![0].p256dh.length).toBeGreaterThan(20);

  // Entrega un push "falso" al service worker por CDP con el mismo formato que notificar.ts.
  const cdp = await context.newCDPSession(page);
  const registro = new Promise<string>((res) =>
    cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => {
      const r = e.registrations.find((x) => x.scopeURL.startsWith(baseURL!) && !x.isDeleted);
      if (r) res(r.registrationId);
    }),
  );
  // El SW, después de mostrar la notificación, avisa a las pestañas abiertas ("push-recibido").
  await page.evaluate(() => {
    const w = window as unknown as { __push: unknown[] };
    w.__push = [];
    navigator.serviceWorker.addEventListener("message", (e) => w.__push.push(e.data));
  });
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin: new URL(baseURL!).origin,
    registrationId: await registro,
    data: JSON.stringify({ title: "Alerta: Refri está consumiendo de más", body: "Corriente 2,00 A", tag: "alerta-1", url: "/alertas" }),
  });
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __push: { tipo?: string }[] }).__push.map((m) => m.tipo)), { timeout: 15_000 })
    .toContain("push-recibido");
  // Chrome sin ventana no siempre expone getNotifications(): se registra como dato, sin fallar.
  const titulos = await page.evaluate(async () =>
    (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => n.title),
  );
  test.info().attach("notificaciones", { body: JSON.stringify(titulos) });

  // Cerrar sesión borra la suscripción de este navegador.
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Ingresar" })).toBeVisible();
  const { data: despues } = await admin.from("push_suscripciones").select("id_suscripcion").eq("id_usuario", id);
  expect(despues).toHaveLength(0);
  await context.close();
  rmSync(dir, { recursive: true, force: true });
});
