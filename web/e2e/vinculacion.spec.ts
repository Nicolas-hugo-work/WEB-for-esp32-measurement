import { expect, test } from "@playwright/test";
import { funcion, lote, macAleatoria, registrar } from "./util";

test("vincular un medidor: código → ESP32 simulado → ¡Listo! → lecturas en el panel", async ({ page }) => {
  await registrar(page);
  await expect(page.getByText("Aún no tienes medidores")).toBeVisible();
  await page.screenshot({ path: "test-results/01-panel-vacio.png" });

  await page.getByRole("link", { name: "Agregar medidor" }).click();
  await page.getByRole("radio", { name: /Refrigerador/ }).click();
  await page.getByLabel("Nombre del medidor").fill("Refri cocina");
  await page.screenshot({ path: "test-results/02-asistente-paso1.png", fullPage: true });
  await page.getByRole("button", { name: "Generar código" }).click();

  const textoCodigo = page.locator("p.font-mono").first();
  await expect(textoCodigo).toHaveText(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  await expect(page.getByText(/Vence en 1[45]:\d\d/)).toBeVisible();
  await page.screenshot({ path: "test-results/03-asistente-codigo.png", fullPage: true });
  const codigo = (await textoCodigo.textContent())!;

  // Recargar a mitad de camino no pierde el código.
  await page.reload();
  await expect(page.locator("p.font-mono").first()).toHaveText(codigo);

  // El "ESP32" canjea el código desde el portal WiFi.
  const v = await funcion("vincular-dispositivo", { codigo, mac: macAleatoria(), firmware: "e2e" });
  expect(v.status).toBe(200);
  await expect(page.getByRole("heading", { name: "¡Listo!" })).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: "test-results/04-listo.png" });

  const ing = await funcion("ingest", { fw: "e2e", lecturas: lote(0.7) }, v.json!.token as string);
  expect(ing.status).toBe(200);

  await page.getByRole("link", { name: "Ver medidor" }).click();
  await expect(page.getByText("0,70 A").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("En línea")).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/05-detalle.png", fullPage: true });

  await page.getByRole("link", { name: "Inicio" }).click();
  await expect(page.getByText("Refri cocina")).toBeVisible();
  await expect(page.getByText(/154 VA/)).toBeVisible(); // 0,7 A × 220 V
  await page.screenshot({ path: "test-results/06-panel.png" });
});

test("un código vencido ofrece generar uno nuevo", async ({ page }) => {
  await registrar(page);
  await page.goto("/agregar");
  // Simula un código guardado que vence en 1,5 s (sessionStorage del asistente).
  await page.evaluate(() =>
    sessionStorage.setItem(
      "medidor:codigo-pendiente",
      JSON.stringify({ codigo: "ABCD2345", vence_en: new Date(Date.now() + 1500).toISOString(), alias: "x" }),
    ),
  );
  await page.reload();
  await expect(page.getByText("El código venció.")).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Generar uno nuevo" }).click();
  await expect(page.getByRole("heading", { name: "¿Qué aparato vas a medir?" })).toBeVisible();
});
