import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Supabase local se sirve por el mismo origen (/supabase → 127.0.0.1:54321).
// Así la web funciona igual en la PC, en el celular por la red local o por un túnel HTTPS.
const SUPABASE_LOCAL = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
const proxy = {
  "/supabase": {
    target: SUPABASE_LOCAL,
    changeOrigin: true,
    ws: true,
    rewrite: (p: string) => p.replace(/^\/supabase/, ""),
  },
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: false,
      devOptions: { enabled: true, type: "module" },
      injectManifest: { globPatterns: ["**/*.{js,css,html,svg,png,woff2}"] },
      manifest: {
        name: "Mi Consumo",
        short_name: "Consumo",
        description: "Consumo eléctrico de tus aparatos, en vivo y con avisos.",
        lang: "es",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: {
    host: true,
    allowedHosts: [".trycloudflare.com", ".ngrok-free.app", "localhost"],
    proxy,
  },
  preview: { host: true, proxy },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
