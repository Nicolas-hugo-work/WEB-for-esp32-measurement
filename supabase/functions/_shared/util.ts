// Utilidades compartidas por las Edge Functions.

export const json = (obj: unknown, status = 200): Response =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function sha256Hex(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function tokenAleatorioHex(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
