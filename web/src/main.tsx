import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { registerSW } from "virtual:pwa-register";
import "uplot/dist/uPlot.min.css";
import "./index.css";
import { AuthProvider } from "./auth/AuthProvider";
import { router } from "./rutas";
import { ToastProvider } from "./components/Toast";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: (n, e) => n < 2 && !(e as { code?: string })?.code?.startsWith("42"),
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
    mutations: { networkMode: "online" },
  },
});

// Mensajes del service worker: push recibido o "abrir esta ruta".
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (ev) => {
    const m = ev.data as { tipo?: string; url?: string } | null;
    if (m?.tipo === "push-recibido") queryClient.invalidateQueries({ queryKey: ["alertas"] });
    if (m?.tipo === "navegar" && m.url) {
      queryClient.invalidateQueries({ queryKey: ["alertas"] });
      router.navigate(m.url);
    }
  });
  registerSW({ immediate: true });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
