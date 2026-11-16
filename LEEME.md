# Medidor de corriente ESP32: versión 2

Contenido:

```
supabase/migrations/20261116000000_esquema_v2.sql   base de datos (tablas, RLS, funciones, tareas programadas)
supabase/migrations/20261116010000_web_v1.sql       lo que necesita la web (serie para gráficos, admin, tarifa, push con enlace)
web/                                                la aplicación web (ver web/README.md)
scripts/simular-esp32.mjs                           simula un ESP32 para probar sin hardware
supabase/functions/vincular-dispositivo/            el ESP32 canjea el código de la web por su token
supabase/functions/ingest/                          el ESP32 manda lotes de lecturas (+ dispara alertas)
supabase/functions/_shared/                         correo (Resend), push (Web Push) y utilidades
firmware/medidor_v2/medidor_v2.ino                  firmware nuevo
```

## Cómo funciona

1. El usuario inicia sesión en la web (correo y contraseña) y toca **Agregar medidor**: elige aparato, ubicación y alias.
   La web llama a `generar_codigo_vinculacion` y muestra un código de 8 caracteres (vence en 15 min, un solo uso).
2. El ESP32 crea la red WiFi `Medidor-XXXX`. El usuario se conecta desde el celular, elige su WiFi y escribe el código.
3. El ESP32 llama a `vincular-dispositivo`, recibe su **token** y lo guarda en su memoria. Ya no necesita ninguna key de Supabase.
4. Cada 15 s manda un lote (una lectura por segundo) a `ingest` con la cabecera `x-device-token`.
   La función evalúa el sobreconsumo y, si corresponde, manda correo y notificación push.

## Despliegue (en este orden)

1. **Migración.** Ejecuta el `.sql` (SQL Editor o `supabase db push`).
   ⚠️ **Borra** las tablas anteriores y sus datos de prueba, y deja de funcionar el firmware viejo.
2. **Edge Functions**, sin verificación JWT (se autorizan con el código o el token del dispositivo):
   ```
   supabase functions deploy vincular-dispositivo --no-verify-jwt
   supabase functions deploy ingest --no-verify-jwt
   ```
3. **Secretos** (`supabase secrets set ...`):
   | Secreto | Qué es |
   |---|---|
   | `RESEND_API_KEY` | clave de resend.com |
   | `EMAIL_FROM` | ej. `Medidor <alertas@tudominio.com>` (dominio verificado en Resend) |
   | `VAPID_PRIVATE_KEY` | el JWK privado completo, en una línea. Se genera con `npx @pushforge/builder vapid` |
   | `VAPID_SUBJECT` | `mailto:tucorreo@...` |

   La clave **pública** VAPID va en la web. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya vienen puestas en las funciones.
4. **Firmware.** Instala en el Arduino IDE: *Adafruit SSD1306*, *Adafruit GFX* y *WiFiManager* (tzapu).
   Sube el sketch. Botón BOOT: pulsación corta = recalibrar el cero (aparato APAGADO), 5 s = restablecer todo.

## Web

La aplicación está en [web/](web/README.md). Para correr todo en local: `npm run db:start`, `npm run functions` y luego `npm run dev` dentro de `web/`.

La migración `20261116010000_web_v1.sql` **no borra nada** y agrega:
- `lecturas_serie()`: serie agregada para los gráficos de varias horas (PostgREST corta en 1000 filas).
- `ultima_lectura` más eficiente (LATERAL ... LIMIT 1 por medidor). Tiene las mismas columnas.
- `evaluar_sobreconsumo()` devuelve `id_medidor`; el push abre `/medidor/{id}` (cambio en `_shared/notificar.ts`).
- `administradores` + `es_admin()`: el administrador edita el catálogo general. Se asigna así:
  `insert into public.administradores (id_usuario) select id from auth.users where email = 'tu@correo';`
- `ajustes_usuario`: tarifa en Bs/kWh por usuario (para estimar el costo).

## Lo que debe hacer la web (supabase-js)

- Registro e inicio de sesión: `auth.signUp` / `auth.signInWithPassword`.
- Código: `supabase.rpc('generar_codigo_vinculacion', { p_id_catalogo, p_id_ubicacion, p_alias })`.
  Devuelve `[{ codigo_generado, vence_en }]`. Muéstralo como `XXXX-XXXX`.
- Saber que ya se vinculó: mira `codigos_vinculacion` (`usado_en` y `id_medidor` se llenan).
- Datos: `ultima_lectura` (en vivo), `lecturas_energia` (días recientes), `lecturas_hora` (histórico), `fallas_hardware`, `alertas`.
- Aparatos propios: `insert` en `catalogo_aparatos` con `id_usuario = auth.uid()`.
- Push: registra un service worker, pide permiso, llama a `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
  y guarda `endpoint`, `p256dh` y `auth` en `push_suscripciones`. El payload llega como `{ title, body, tag, url }`.

## Límites y cosas a tener en cuenta

- **Correo:** con el remitente de prueba de Resend solo puedes mandar a tu propio correo. Para avisar a otros usuarios hay que verificar un dominio.
- **Push en iPhone:** según lo que sé, solo funciona si el usuario instala la web en la pantalla de inicio.
- **Almacenamiento:** una lectura por segundo son unas 86 400 filas por medidor al día. El SQL resume por hora y borra las lecturas
  en bruto de más de 3 días (tareas `pg_cron`, 03:15 hora de Bolivia). Revisa el uso real en el panel de Supabase.
- **Alertas:** umbral = corriente nominal del catálogo + 20 %, sostenido 30 s, y como máximo una alerta cada 30 min por medidor. Todo es editable por aparato.
- **Seguridad pendiente:** el firmware usa `setInsecure()` (no valida el certificado del servidor). Hay que cambiarlo antes de venderlo.
- **Calibración:** el cero se calcula una vez (con el aparato apagado) y se guarda. Si el "ruido" equivale a más de `RUIDO_MAX_EQUIV_A` (0.5 A) se rechaza.
  Ese número es una estimación: ajústalo con tu hardware.
- **Sensor:** el factor `×50` del código es para el SCT013 de 50 A/1 V. Verifica tu modelo con una pinza amperimétrica.

## Qué se probó y qué no

- SQL: 38 pruebas en un Postgres local (PGlite): vinculación, alertas, RLS, resumen y purga. Todas pasan.
- Edge Functions: revisión de tipos con Deno, sin errores. No se ejecutaron contra Supabase real.
- Firmware: revisión de sintaxis y tipos con stubs. **No se compiló para ESP32 ni se probó en la placa.**
  Si algo no compila con tu versión de WiFiManager o del core ESP32, pásame el error.
