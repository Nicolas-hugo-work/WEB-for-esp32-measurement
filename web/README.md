# Mi Consumo: web del medidor ESP32

**Producción:** https://mi-consumo-mu.vercel.app (Vercel, proyecto `mi-consumo`, se despliega solo con cada push a `main`).

PWA mobile-first en español: vincular medidores, ver el consumo en vivo y el histórico, estimar el costo en Bs, configurar alertas y recibir notificaciones push.

**Stack:** Vite + React 19 + TypeScript · TanStack Query (polling) · supabase-js (solo la *publishable key*; la seguridad la da RLS) · uPlot · Tailwind 4 · vite-plugin-pwa (service worker propio en `src/sw.ts`).

## Correr todo en local

Requisitos: Node 20 o más reciente, Docker Desktop encendido y Chrome (para las pruebas E2E).

```bash
# 1. En la raíz del repo: base de datos + Auth + Edge Functions locales
npm install
npm run db:start            # aplica las migraciones de supabase/migrations
npm run functions           # deja corriendo vincular-dispositivo e ingest (otra terminal)

# 2. En web/: la aplicación
cd web
npm install
cp .env.example .env.local  # completa la publishable key (npx supabase status) y VAPID pública
npm run dev                 # http://localhost:5173
```

- La web llama a Supabase por el **mismo origen** (`/supabase`, un proxy de Vite). Por eso también funciona desde el celular en la misma red WiFi (`http://IP-DE-TU-PC:5173`).
- Los correos de Auth (confirmación, recuperar contraseña) se ven en **Mailpit**: http://127.0.0.1:54324.
- Claves VAPID: `npx @pushforge/builder vapid`. La pública va en `web/.env.local` (`VITE_VAPID_PUBLIC_KEY`). El JWK privado va en `supabase/functions/.env` (`VAPID_PRIVATE_KEY`). Ninguno de los dos archivos se sube al repo.

### Probar sin el ESP32: simulador

```bash
# en la raíz, con el asistente "Agregar medidor" mostrando un código:
npm run simular -- vincular ABCD-2345
npm run simular -- enviar 0.7                       # un lote cada 15 s, ~0,7 A
npm run simular -- enviar 0.7 --pico 5 --cada 120   # picos de 5 A para disparar alertas
npm run simular -- falla CERO_FALLIDO
```

### Push y PWA en el celular

Las notificaciones push y el service worker solo funcionan en **HTTPS** (o en `localhost`). Para probarlos desde un celular sin dominio propio:

```bash
npx cloudflared tunnel --url http://localhost:5173   # entrega una URL https://….trycloudflare.com temporal
```

- **Android (Chrome):** abre la URL, ve a Ajustes y toca «Activar avisos».
- **iPhone (iOS 16.4 o posterior):** abre la URL en Safari, elige *Compartir → Agregar a inicio*, abre la app desde el ícono y activa los avisos en Ajustes. Sin instalarla, iOS no permite push.

## Desplegar en la nube (Supabase + Vercel)

Proyecto Supabase: `wnnevrbowgyepbkggwyr`. El firmware ya apunta a ese proyecto.

### 1. Supabase

Desde la raíz del repo:

```bash
npx supabase login
npx supabase link --project-ref wnnevrbowgyepbkggwyr
npx supabase db push                     # aplica las 2 migraciones en orden (⚠️ la v2 BORRA las tablas viejas)
npx supabase functions deploy vincular-dispositivo --no-verify-jwt
npx supabase functions deploy ingest --no-verify-jwt
npx supabase secrets set --env-file supabase/functions/.env   # VAPID_PRIVATE_KEY y VAPID_SUBJECT (+ RESEND_API_KEY si la tienes)
```

En el panel de Supabase:
- **Authentication → URL Configuration:** *Site URL* = `https://TU-APP.vercel.app`. En *Redirect URLs* agrega `https://TU-APP.vercel.app/**`.
- **Authentication → Sign In / Providers → Email:** sin un SMTP propio, Supabase **solo envía correos a los miembros de tu organización**. Con registro abierto, desactiva *Confirm email* hasta configurar un SMTP con dominio. Si no, los demás usuarios no podrán confirmar su cuenta ni recuperar la contraseña.
- **Administrador del catálogo** (después de registrarte en la web), en el SQL Editor:
  `insert into public.administradores (id_usuario) select id from auth.users where email = 'tu@correo';`

### 2. Vercel

1. *Add New → Project* → importa el repo de GitHub.
2. **Root Directory: `web`**. El resto ya está en `vercel.json`: Vite, rutas de SPA, cabeceras de seguridad (CSP) y caché del service worker.
3. *Deploy*. Las variables públicas salen de `web/.env.production`. Si las defines en *Settings → Environment Variables*, esas tienen prioridad.

El build de Vercel corre `npm run build:vercel`: typecheck, build y revisión de que no haya secretos en el bundle.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | servidor de desarrollo |
| `npm run build` | typecheck + build de producción (`dist/`) |
| `npm run check:secrets` | falla si el bundle contiene una clave secreta (`service_role`, `sb_secret_…`, JWK privado, Resend) |
| `npm test` | pruebas unitarias (Vitest) |
| `npm run test:integracion` | 42 comprobaciones contra Supabase local: vinculación, ingesta, alertas, RLS entre 2 usuarios, permisos por columna, administrador, tarifa |
| `npm run test:e2e` | Playwright con Chrome: vinculación completa, código vencido, push (activación + entrega por CDP + borrado al cerrar sesión) |
| `npm run lint` | ESLint (prohíbe `dangerouslySetInnerHTML`) |

## Estructura

```
src/
  lib/          supabase, env (validado con zod), electrica (VA, umbral, kWh, Bs), fechas (La Paz), errores, fallas
  auth/         sesión, ruta protegida, ingresar / registro / recuperar / restablecer
  components/   UI base, layout con barra inferior, diálogo, estados vacío/carga/error
  features/
    medidores/  panel, detalle, gráficos, editar / desvincular / eliminar
    vinculacion/ asistente (código XXXX-XXXX, cuenta regresiva, polling, retomar)
    alertas/    centro de alertas, configuración por aparato
    catalogo/   catálogo general y propio (el administrador edita el general)
    ubicaciones/
    ajustes/    push, tarifa, cuenta
    push/       suscripción Web Push y formato del payload
  sw.ts         precache, push y clic en la notificación
```

## Decisiones

- **Potencia:** VA = corriente × 220 V. La energía y el costo son estimados (suponen factor de potencia 1).
- **Tarifa:** cada usuario la configura en Ajustes. Si no la configura se usa 0,80 Bs/kWh, un valor orientativo.
- **Zona horaria:** America/La_Paz. Los días se cortan a la medianoche de Bolivia.
- **En línea:** el medidor envió algo en los últimos 60 s (manda un lote cada 15 s).
- **Falla activa:** hay una falla de hace menos de 11 min y no llegaron lecturas después.
- **Desvincular:** conserva el historial (`activo = false`). El ESP32 borra su token al reconectarse. **Eliminar** borra todo.
- **Administrador:** se asigna por SQL (ver `supabase/migrations/20261116010000_web_v1.sql`).
