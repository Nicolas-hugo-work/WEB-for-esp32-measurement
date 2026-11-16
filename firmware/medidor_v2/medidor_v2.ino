// ESP32 + SCT013 (50A/1V) + OLED  -  v2.0.0
// Medidor de corriente con vinculacion por codigo (portal WiFi) y envio por lotes.
//
// Librerias (Gestor de librerias de Arduino IDE):
//   - Adafruit SSD1306, Adafruit GFX
//   - WiFiManager de tzapu (v2.0.17)
//
// Flujo:
//   1) Primera vez: el ESP32 crea la red "Medidor-XXXX". Conectate desde el celular,
//      elige tu WiFi y escribe el codigo que te dio la web.
//   2) El token secreto queda guardado en la memoria del ESP32 (NVS).
//   3) Mide cada 1 s y envia un lote cada 15 s a la Edge Function "ingest".
//   Para recalibrar el cero (con el aparato APAGADO) envia "c" por el Monitor Serie.

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <math.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WiFiManager.h>
#include <Preferences.h>

// ===================== SERVIDOR =====================
constexpr char SUPABASE_URL[] = "https://wnnevrbowgyepbkggwyr.supabase.co";
constexpr char RUTA_VINCULAR[] = "/functions/v1/vincular-dispositivo";
constexpr char RUTA_INGEST[] = "/functions/v1/ingest";
constexpr char FIRMWARE_VERSION[] = "2.0.0";

constexpr uint32_t INTERVALO_LECTURA_MS = 1000;   // una lectura por segundo
constexpr uint32_t INTERVALO_ENVIO_MS = 15000;    // un lote cada 15 s
constexpr uint32_t REINTENTO_FALLA_MS = 5000;     // minimo entre envios urgentes
constexpr uint32_t REPETIR_FALLA_MS = 300000;     // repetir una falla persistente cada 5 min
constexpr uint8_t MAX_MUESTRAS = 60;              // buffer: 1 minuto sin WiFi
// ====================================================

constexpr uint8_t PIN_SENSOR = 34;
constexpr uint8_t PIN_SDA = 21;
constexpr uint8_t PIN_SCL = 22;
constexpr uint8_t PASADAS = 5;
constexpr double CALIBRACION = 1.0;
constexpr double VOLTAJE_RED = 220.0;
constexpr double ALPHA = 0.25;
constexpr uint16_t MUESTRAS = 1000;
constexpr uint32_t PERIODO_US = 500;
constexpr uint8_t VENTANAS_CERO = 8;
// Si el "ruido" medido al calibrar equivale a mas de esto, es que el aparato
// estaba encendido: se rechaza la calibracion. Ajustalo con tu hardware.
constexpr double RUIDO_MAX_EQUIV_A = 0.5;
static_assert(PASADAS > 0, "PASADAS debe ser mayor que cero");
static_assert(ALPHA > 0 && ALPHA <= 1, "ALPHA debe estar entre 0 y 1");

Adafruit_SSD1306 pantalla(128, 64, &Wire, -1);
Preferences prefs;
bool oledOK = false;
bool ceroOK = false;
bool ceroFallido = false;
bool filtroIniciado = false;
bool solicitarCalibracion = false;
double ruidoVarianza = 0;
double umbralVarianza = 0;
double corrienteFiltrada = 0;
String tokenDispositivo;

struct Lectura {
  double medio;
  double varianza;
  double minimo;
  double maximo;
};

struct Muestra {
  uint32_t tMs;
  float a;
  uint32_t seq;
};
struct Falla {
  bool pendiente;
  char codigo[20];
  float bias;
  uint32_t seq;
};
Muestra muestras[MAX_MUESTRAS];
uint8_t nMuestras = 0;
uint32_t seqMuestra = 0;
Falla falla = {false, "", 0, 0};
char ultimaFallaCodigo[20] = "";
uint32_t ultimaFallaMs = 0;
portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

Lectura medir();
bool divisorOK(const Lectura &r);
bool rangoOK(const Lectura &r);
double convertirAmperios(double voltajeRMS);
void mensaje(const char *a, const char *b);
void mostrar(double corriente, const Lectura &r, const char *estado);
void calibrarRuido();
void guardarCalibracion();
bool cargarCalibracion();
void agregarMuestra(float a);
void reportarFalla(const char *codigo, double bias);
void esperarHasta(uint32_t t);
String nombrePortal();
bool soloHex64(const String &s);
bool vincularConCodigo(const char *codigoCrudo);
void conectarYVincular();
void tareaRed(void *param);
void setup();
void loop();

// ---------------------------------------------------------------- medicion
Lectura medir() {
  double suma = 0;
  double suma2 = 0;
  uint32_t minimoMV = UINT32_MAX, maximoMV = 0;
  uint32_t siguiente = micros();
  for (uint16_t i = 0; i < MUESTRAS; i++) {
    while ((int32_t)(micros() - siguiente) < 0) delayMicroseconds(1);
    siguiente += PERIODO_US;
    const uint32_t mv = analogReadMilliVolts(PIN_SENSOR);
    const double v = mv / 1000.0;
    suma += v;
    suma2 += v * v;
    if (mv < minimoMV) minimoMV = mv;
    if (mv > maximoMV) maximoMV = mv;
  }
  const double medio = suma / MUESTRAS;
  double varianza = suma2 / MUESTRAS - medio * medio;
  if (varianza < 0) varianza = 0;
  return {medio, varianza, minimoMV / 1000.0, maximoMV / 1000.0};
}

bool divisorOK(const Lectura &r) {
  return r.medio >= 1.40 && r.medio <= 1.90;
}
bool rangoOK(const Lectura &r) {
  return r.minimo > 0.15 && r.maximo < 3.10;
}

double convertirAmperios(double voltajeRMS) {
  return voltajeRMS * 50.0 * CALIBRACION / PASADAS;
}

// ---------------------------------------------------------------- pantalla
void mensaje(const char *a, const char *b) {
  if (!oledOK) return;
  pantalla.clearDisplay();
  pantalla.setTextColor(SSD1306_WHITE);
  pantalla.setTextSize(1);
  pantalla.setCursor(0, 12);
  pantalla.println(a);
  pantalla.println();
  pantalla.println(b);
  pantalla.display();
}

void mostrar(double corriente, const Lectura &r, const char *estado) {
  if (!oledOK) return;
  pantalla.clearDisplay();
  pantalla.setTextColor(SSD1306_WHITE);
  pantalla.setTextSize(1);
  pantalla.setCursor(0, 0);
  pantalla.print("SCT013 50A/1V");
  pantalla.setTextSize(2);
  pantalla.setCursor(0, 14);
  pantalla.print(corriente, 3);
  pantalla.print(" A");
  pantalla.setTextSize(1);
  pantalla.setCursor(0, 36);
  pantalla.print(estado);
  pantalla.setCursor(0, 46);
  pantalla.print("S~ ");
  pantalla.print(corriente * VOLTAJE_RED, 1);
  pantalla.print(" VA");
  pantalla.setCursor(0, 56);
  pantalla.print("Bias ");
  pantalla.print(r.medio, 2);
  pantalla.print(" V");
  pantalla.display();
}

// ------------------------------------------------------------- calibracion
void guardarCalibracion() {
  prefs.putDouble("ruido", ruidoVarianza);
  prefs.putDouble("umbral", umbralVarianza);
  prefs.putBool("calok", true);
}

bool cargarCalibracion() {
  if (!prefs.getBool("calok", false)) return false;
  ruidoVarianza = prefs.getDouble("ruido", 0);
  umbralVarianza = prefs.getDouble("umbral", 0);
  ceroOK = true;
  ceroFallido = false;
  Serial.println("Calibracion de cero cargada de la memoria.");
  return true;
}

void calibrarRuido() {
  ceroOK = false;
  ceroFallido = false;
  filtroIniciado = false;
  corrienteFiltrada = NAN;
  mensaje("CALIBRO RUIDO", "SIN corriente");
  Serial.println("Calibro SIN corriente; sensor y divisor siguen conectados.");
  double promedio = 0, m2 = 0;
  uint8_t aceptadas = 0;
  for (uint8_t intento = 1;
       intento <= VENTANAS_CERO * 2 && aceptadas < VENTANAS_CERO;
       intento++) {
    const Lectura r = medir();
    if (!divisorOK(r) || !rangoOK(r)) {
      Serial.printf("CERO: descarto ventana %u: %s | Bias=%.3f V | Min=%.3f V | Max=%.3f V\n",
                    intento, !divisorOK(r) ? "bias fuera de rango" : "extremos fuera de rango ADC",
                    r.medio, r.minimo, r.maximo);
      delay(10);
      continue;
    }
    aceptadas++;
    const double delta = r.varianza - promedio;
    promedio += delta / aceptadas;
    m2 += delta * (r.varianza - promedio);
    delay(10);
  }
  if (aceptadas < VENTANAS_CERO) {
    ceroFallido = true;
    Serial.printf("CERO FALLIDO: %u/%u ventanas validas. Corrijo cableado y envio c SIN corriente.\n",
                  aceptadas, VENTANAS_CERO);
    mensaje("CERO FALLIDO", "Revisa cableado");
    return;
  }
  const double iEq = convertirAmperios(sqrt(promedio));
  if (iEq > RUIDO_MAX_EQUIV_A) {
    ceroFallido = true;
    Serial.printf("CERO INVALIDO: el ruido equivale a %.3f A (max %.2f A). Apaga el aparato y repite.\n",
                  iEq, RUIDO_MAX_EQUIV_A);
    mensaje("CERO INVALIDO", "Apaga el aparato");
    return;
  }
  ruidoVarianza = promedio;
  umbralVarianza = 3.0 * sqrt(m2 / (VENTANAS_CERO - 1));
  ceroOK = true;
  guardarCalibracion();
  Serial.printf("CERO OK | Ruido=%.3f mV RMS | I_equivalente=%.4f A | Umbral extra=%.4f A\n",
                sqrt(ruidoVarianza) * 1000.0, iEq, convertirAmperios(sqrt(umbralVarianza)));
  Serial.println("Ya puedes conectar la carga.");
}

// ------------------------------------------------- buffer y fallas (compartido)
void agregarMuestra(float a) {
  portENTER_CRITICAL(&mux);
  if (nMuestras == MAX_MUESTRAS) {  // lleno: descarta la mas vieja
    memmove(&muestras[0], &muestras[1], (MAX_MUESTRAS - 1) * sizeof(Muestra));
    nMuestras--;
  }
  muestras[nMuestras++] = {millis(), a, ++seqMuestra};
  portEXIT_CRITICAL(&mux);
}

// Solo avisa cuando cambia la falla (o cada 5 min si persiste).
void reportarFalla(const char *codigo, double bias) {
  const uint32_t ahora = millis();
  if (strcmp(codigo, ultimaFallaCodigo) == 0 && ahora - ultimaFallaMs < REPETIR_FALLA_MS) return;
  strncpy(ultimaFallaCodigo, codigo, sizeof(ultimaFallaCodigo) - 1);
  ultimaFallaCodigo[sizeof(ultimaFallaCodigo) - 1] = '\0';
  ultimaFallaMs = ahora;
  portENTER_CRITICAL(&mux);
  falla.pendiente = true;
  strncpy(falla.codigo, codigo, sizeof(falla.codigo) - 1);
  falla.codigo[sizeof(falla.codigo) - 1] = '\0';
  falla.bias = (float)bias;
  falla.seq++;
  portEXIT_CRITICAL(&mux);
}

// ------------------------------------------------------------------ espera
void esperarHasta(uint32_t t) {
  while ((int32_t)(millis() - t) < 0) delay(10);
}

// ----------------------------------------------------- WiFi y vinculacion
String nombrePortal() {
  const uint64_t id = ESP.getEfuseMac();
  char b[24];
  snprintf(b, sizeof(b), "Medidor-%02X%02X", (uint8_t)(id >> 32), (uint8_t)(id >> 40));
  return String(b);
}

bool soloHex64(const String &s) {
  if (s.length() != 64) return false;
  for (size_t i = 0; i < 64; i++) {
    if (!isxdigit((unsigned char)s[i])) return false;
  }
  return true;
}

bool vincularConCodigo(const char *codigoCrudo) {
  // Deja solo letras/numeros en mayuscula (acepta "ABCD-EFGH").
  char codigo[17];
  size_t n = 0;
  for (const char *p = codigoCrudo; *p && n < sizeof(codigo) - 1; p++) {
    if (isalnum((unsigned char)*p)) codigo[n++] = (char)toupper((unsigned char)*p);
  }
  codigo[n] = '\0';
  if (n != 8) {
    Serial.println("VINCULAR: el codigo debe tener 8 caracteres");
    return false;
  }

  mensaje("VINCULANDO", "Un momento...");
  WiFiClientSecure cliente;
  cliente.setInsecure();  // TODO: validar certificado (CA) antes de venderlo
  HTTPClient http;
  http.setTimeout(15000);
  char url[160];
  snprintf(url, sizeof(url), "%s%s", SUPABASE_URL, RUTA_VINCULAR);
  if (!http.begin(cliente, url)) return false;
  http.addHeader("Content-Type", "application/json");

  char cuerpo[160];
  snprintf(cuerpo, sizeof(cuerpo), "{\"codigo\":\"%s\",\"mac\":\"%s\",\"firmware\":\"%s\"}",
           codigo, WiFi.macAddress().c_str(), FIRMWARE_VERSION);
  const int c = http.POST((uint8_t *)cuerpo, strlen(cuerpo));
  const String resp = (c > 0) ? http.getString() : String();
  http.end();

  if (c != 200) {
    Serial.printf("VINCULAR: HTTP %d %s\n", c, resp.c_str());
    return false;
  }
  const int i = resp.indexOf("\"token\":\"");
  if (i < 0) return false;
  const String tok = resp.substring(i + 9, i + 9 + 64);
  if (!soloHex64(tok)) return false;
  prefs.putString("token", tok);
  tokenDispositivo = tok;
  Serial.println("VINCULAR: dispositivo vinculado");
  return true;
}

void conectarYVincular() {
  WiFiManager wm;
  WiFiManagerParameter pCodigo("codigo", "Codigo de la web (8 caracteres)", "", 16,
                               "autocapitalize=\"characters\" autocomplete=\"off\"");
  wm.addParameter(&pCodigo);
  wm.setConnectTimeout(20);
  wm.setConfigPortalTimeout(600);
  const String ap = nombrePortal();

  mensaje("WIFI", ap.c_str());
  Serial.printf("Portal WiFi: red \"%s\" (si no hay WiFi guardado)\n", ap.c_str());
  bool conectado = wm.autoConnect(ap.c_str());
  WiFi.setAutoReconnect(true);

  while (tokenDispositivo.length() == 0) {
    if (conectado && strlen(pCodigo.getValue()) >= 8) {
      if (vincularConCodigo(pCodigo.getValue())) break;
      mensaje("CODIGO INVALIDO", "Intenta de nuevo");
      delay(1500);
    }
    // Sin token: abre el portal para (re)escribir el codigo.
    mensaje("CONECTATE A", ap.c_str());
    pCodigo.setValue("", 16);
    conectado = wm.startConfigPortal(ap.c_str());
  }
}

// ------------------------------------------------------------ envio (nucleo 0)
void tareaRed(void *param) {
  (void)param;
  WiFiClientSecure cliente;
  cliente.setInsecure();  // TODO: validar certificado (CA) antes de venderlo
  HTTPClient http;
  http.setReuse(true);
  http.setTimeout(10000);

  char url[160];
  snprintf(url, sizeof(url), "%s%s", SUPABASE_URL, RUTA_INGEST);
  static char cuerpo[2304];
  uint32_t ultimoIntento = 0;

  for (;;) {
    vTaskDelay(pdMS_TO_TICKS(250));
    if (WiFi.status() != WL_CONNECTED) continue;

    const uint32_t ahora = millis();
    bool urgente;
    uint8_t n;
    portENTER_CRITICAL(&mux);
    urgente = falla.pendiente;
    n = nMuestras;
    portEXIT_CRITICAL(&mux);

    const uint32_t desde = ahora - ultimoIntento;
    if (!((urgente && desde >= REINTENTO_FALLA_MS) || (n > 0 && desde >= INTERVALO_ENVIO_MS))) continue;
    ultimoIntento = ahora;

    // Copia el estado compartido y arma el JSON fuera de la seccion critica.
    Muestra copia[MAX_MUESTRAS];
    uint8_t nc;
    Falla f;
    portENTER_CRITICAL(&mux);
    nc = nMuestras;
    memcpy(copia, muestras, nc * sizeof(Muestra));
    f = falla;
    portEXIT_CRITICAL(&mux);

    int len = snprintf(cuerpo, sizeof(cuerpo), "{\"fw\":\"%s\",\"lecturas\":[", FIRMWARE_VERSION);
    uint32_t ultimaSeqEnviada = 0;
    for (uint8_t i = 0; i < nc; i++) {
      if (len > (int)sizeof(cuerpo) - 120) break;  // deja sitio para la falla y el cierre
      const float dt = (ahora - copia[i].tMs) / 1000.0f;
      len += snprintf(cuerpo + len, sizeof(cuerpo) - len, "%s{\"dt\":%.1f,\"a\":%.4f}",
                      i ? "," : "", dt, copia[i].a);
      ultimaSeqEnviada = copia[i].seq;
    }
    len += snprintf(cuerpo + len, sizeof(cuerpo) - len, "]");
    if (f.pendiente) {
      len += snprintf(cuerpo + len, sizeof(cuerpo) - len,
                      ",\"falla\":{\"codigo\":\"%s\",\"bias_v\":%.3f}", f.codigo, f.bias);
    }
    snprintf(cuerpo + len, sizeof(cuerpo) - len, "}");

    if (!http.begin(cliente, url)) {
      Serial.println("RED: no pude iniciar la conexion HTTPS");
      continue;
    }
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-token", tokenDispositivo);
    const int codigo = http.POST((uint8_t *)cuerpo, strlen(cuerpo));

    if (codigo == 200) {
      portENTER_CRITICAL(&mux);
      uint8_t k = 0;  // quita las muestras ya enviadas (por seq, aunque se hayan descartado otras)
      while (k < nMuestras && muestras[k].seq <= ultimaSeqEnviada) k++;
      if (k > 0) {
        memmove(&muestras[0], &muestras[k], (nMuestras - k) * sizeof(Muestra));
        nMuestras -= k;
      }
      if (f.pendiente && falla.seq == f.seq) falla.pendiente = false;
      portEXIT_CRITICAL(&mux);
    } else if (codigo == 401 || codigo == 403) {
      Serial.println("RED: token rechazado (medidor desvinculado). Borro el token y reinicio.");
      http.end();
      prefs.remove("token");
      mensaje("DESVINCULADO", "Reiniciando...");
      delay(1500);
      ESP.restart();
    } else if (codigo > 0) {
      Serial.printf("RED: error HTTP %d: %s\n", codigo, http.getString().c_str());
    } else {
      Serial.printf("RED: error de conexion: %s\n", http.errorToString(codigo).c_str());
    }
    http.end();
  }
}

// ------------------------------------------------------------------- arduino
void setup() {
  Serial.begin(115200);
  Serial.printf("ESP32 SCT013 OLED v%s - GPIO34 - vinculacion por codigo\n", FIRMWARE_VERSION);
  Wire.begin(PIN_SDA, PIN_SCL);
  for (uint8_t direccion = 0x3C; direccion <= 0x3D; direccion++) {
    Wire.beginTransmission(direccion);
    if (Wire.endTransmission() == 0) {
      oledOK = pantalla.begin(SSD1306_SWITCHCAPVCC, direccion, true, false);
      if (oledOK) break;
    }
  }
  if (!oledOK) Serial.println("OLED no detectada: continuo por Monitor Serie.");
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_SENSOR, ADC_11db);

  prefs.begin("medidor", false);
  tokenDispositivo = prefs.getString("token", "");
  conectarYVincular();

  if (!cargarCalibracion()) {
    Serial.println("Dejo SIN corriente el conductor durante el cero inicial.");
    mensaje("INICIO EN 5 SEGUNDOS", "Apaga el aparato");
    delay(5000);
    analogReadMilliVolts(PIN_SENSOR);
    calibrarRuido();
  }
  xTaskCreatePinnedToCore(tareaRed, "red", 16384, NULL, 1, NULL, 0);
}

void loop() {
  while (Serial.available()) {
    const char c = Serial.read();
    if (c == 'c' || c == 'C') solicitarCalibracion = true;
  }
  if (solicitarCalibracion) {
    solicitarCalibracion = false;
    calibrarRuido();
  }

  const uint32_t t0 = millis();
  const Lectura r = medir();
  const bool valida = divisorOK(r) && rangoOK(r);

  if (!valida || !ceroOK) {
    filtroIniciado = false;
    corrienteFiltrada = NAN;
    const char *codigo;
    const char *estado;
    if (!divisorOK(r)) {
      codigo = "REVISAR_DIVISOR";
      estado = "REVISAR DIVISOR";
    } else if (!rangoOK(r)) {
      codigo = "FUERA_RANGO_ADC";
      estado = "FUERA RANGO ADC";
    } else {
      codigo = ceroFallido ? "CERO_FALLIDO" : "SIN_CALIBRAR_CERO";
      estado = ceroFallido ? "CERO FALLIDO" : "SIN CALIBRAR CERO";
    }
    mensaje(estado, (codigo[0] == 'S' || codigo[0] == 'C') ? "Envia c sin carga" : "Revisa cableado");
    Serial.printf("Vrms_bruto=%.3f mV | Bias=%.3f V | Min=%.3f V | Max=%.3f V | %s | A y VA no disponibles\n",
                  sqrt(r.varianza) * 1000.0, r.medio, r.minimo, r.maximo, estado);
    reportarFalla(codigo, r.medio);
    esperarHasta(t0 + INTERVALO_LECTURA_MS);
    return;
  }

  ultimaFallaCodigo[0] = '\0';  // sin falla: si reaparece, se vuelve a avisar
  const double corrienteBruta = convertirAmperios(sqrt(r.varianza));
  double varianzaNeta = r.varianza - ruidoVarianza;
  const bool bajoRuido = varianzaNeta <= umbralVarianza;
  if (varianzaNeta < 0 || bajoRuido) varianzaNeta = 0;
  const double corrienteCorregida = convertirAmperios(sqrt(varianzaNeta));
  if (!filtroIniciado || bajoRuido) corrienteFiltrada = corrienteCorregida;
  else corrienteFiltrada += ALPHA * (corrienteCorregida - corrienteFiltrada);
  filtroIniciado = true;
  const char *estado = bajoRuido ? "BAJO UMBRAL RUIDO" : "MIDIENDO RMS";
  mostrar(corrienteFiltrada, r, estado);
  Serial.printf("I_bruta=%.4f A | I_corregida=%.4f A | I_filtro=%.4f A | S~=%.2f VA | Bias=%.3f V | %s\n",
                corrienteBruta, corrienteCorregida, corrienteFiltrada,
                corrienteFiltrada * VOLTAJE_RED, r.medio, estado);
  agregarMuestra((float)corrienteFiltrada);
  esperarHasta(t0 + INTERVALO_LECTURA_MS);
}