#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// ==========================================
// 1. CONFIGURATION (EDIT THESE 5 VALUES)
// ==========================================
const char* WIFI_SSID     = "AibotInk_workshop";
const char* WIFI_PASSWORD = "Aibotink@123";
const char* SERVER_HOST   = "72.61.141.178";  // Hostname or IP (do NOT include http:// or ws://)
const int   SERVER_PORT   = 7000;             // Port
const char* DEVICE_ID     = "BOX_WCUUY9";     // Locker Serial from Admin
const char* DEVICE_KEY    = "sbx_live_40435e76da3b2f52aad6321b60d3edc3"; // Secret Provision Key

// ==========================================
// 2. PIN DEFINITIONS & TIMING
// ==========================================
const int PIN_ACTUATOR    = 23;  // Relay control (HIGH = 12V pulse to release latch)
const int PIN_DOOR_SENSOR = 22;  // Solenoid feedback wire (INPUT_PULLUP: LOW = closed, HIGH = open)

// Timing settings
const unsigned long DEFAULT_UNLOCK_DURATION = 200;   // 200ms power pulse default
const unsigned long HEARTBEAT_INTERVAL      = 15000; // Keep-alive ping every 15 seconds
const unsigned long DEBOUNCE_DELAY          = 60;    // Sensor debounce in ms
const unsigned long WIFI_RETRY_INTERVAL     = 5000;  // Non-blocking Wi-Fi reconnect retry interval

// Global Objects & State
WebSocketsClient webSocket;
unsigned long lastHeartbeatTime    = 0;
unsigned long lastDebounceTime     = 0;
unsigned long unlockStartTime      = 0;
unsigned long activeUnlockDuration = DEFAULT_UNLOCK_DURATION;
unsigned long lastWifiRetryTime    = 0;
bool isUnlocking                   = false;
int lastSensorReading              = -1;
bool isWsConnected                 = false;

// Function declarations
void connectWiFiInitial();
void maintainWiFi();
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length);
void handleIncomingCommand(uint8_t * payload, size_t length);
void sendDoorTelemetry(const char* stateStr);
void sendHeartbeat();
void monitorSensor();
void manageRelayTimer();
String sanitizeHost(const String& host);

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==========================================");
  Serial.println("  SECURE BOX - ESP32 WEBSOCKET FIRMWARE   ");
  Serial.println("==========================================");

  // Configure Pins
  pinMode(PIN_ACTUATOR, OUTPUT);
  digitalWrite(PIN_ACTUATOR, LOW); // Locked by default

  pinMode(PIN_DOOR_SENSOR, INPUT_PULLUP);
  lastSensorReading = digitalRead(PIN_DOOR_SENSOR);

  // Initial Wi-Fi connection
  connectWiFiInitial();

  // Configure WebSocket Client
  String cleanHost = sanitizeHost(SERVER_HOST);
  String wsPath = "/ws/device?deviceId=" + String(DEVICE_ID) + "&deviceKey=" + String(DEVICE_KEY);
  Serial.printf("[WS] Configuring connection to ws://%s:%d%s\n", cleanHost.c_str(), SERVER_PORT, wsPath.c_str());

  webSocket.begin(cleanHost.c_str(), SERVER_PORT, wsPath.c_str());
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000);      // Auto-reconnect every 3 seconds if disconnected
  webSocket.enableHeartbeat(15000, 3000, 2); // Native RFC 6455 WebSocket ping/pong
}

void loop() {
  // 1. CRITICAL HARDWARE SAFETY: Relay timer must ALWAYS execute first, uninterrupted!
  manageRelayTimer();

  // 2. Physical door sensor monitor with debouncing
  monitorSensor();

  // 3. Non-blocking Wi-Fi maintenance (never blocks relay timer or sensor)
  maintainWiFi();

  // 4. Run WebSocket event loop if Wi-Fi is connected
  if (WiFi.status() == WL_CONNECTED) {
    webSocket.loop();

    // 5. Periodic Heartbeat frame (every 15 seconds)
    if (isWsConnected && (millis() - lastHeartbeatTime >= HEARTBEAT_INTERVAL)) {
      lastHeartbeatTime = millis();
      sendHeartbeat();
    }
  }
}

// ==========================================
// HOST SANITIZATION HELPER
// ==========================================
String sanitizeHost(const String& host) {
  String clean = host;
  clean.trim();
  if (clean.startsWith("http://"))  clean = clean.substring(7);
  if (clean.startsWith("https://")) clean = clean.substring(8);
  if (clean.startsWith("ws://"))    clean = clean.substring(5);
  if (clean.startsWith("wss://"))   clean = clean.substring(6);
  int slashIdx = clean.indexOf('/');
  if (slashIdx != -1) clean = clean.substring(0, slashIdx);
  int colonIdx = clean.indexOf(':');
  if (colonIdx != -1) clean = clean.substring(0, colonIdx);
  return clean;
}

// ==========================================
// WI-FI CONNECTION MANAGERS
// ==========================================
void connectWiFiInitial() {
  Serial.printf("\n[WIFI] Connecting to SSID: %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startAttempt < 15000)) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Connected! IP Address: %s | RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("\n[WIFI] Initial Connection Failed! Will retry in main loop...");
  }
}

void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  if (isWsConnected) {
    isWsConnected = false;
    Serial.println("\n[WIFI] Wi-Fi connection lost!");
  }

  // Non-blocking reconnection attempts every WIFI_RETRY_INTERVAL
  if (millis() - lastWifiRetryTime >= WIFI_RETRY_INTERVAL) {
    lastWifiRetryTime = millis();
    Serial.println("[WIFI] Attempting Wi-Fi reconnection...");
    WiFi.disconnect();
    WiFi.reconnect();
  }
}

// ==========================================
// WEBSOCKET EVENT HANDLER
// ==========================================
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      isWsConnected = false;
      Serial.println("[WS] Disconnected from server. Auto-reconnecting in 3s...");
      break;

    case WStype_CONNECTED:
      isWsConnected = true;
      Serial.printf("[WS] Connected to ws://%s:%d/ws/device ✅\n", sanitizeHost(SERVER_HOST).c_str(), SERVER_PORT);

      // Report and synchronize initial door sensor state immediately upon connection
      {
        int currentReading = digitalRead(PIN_DOOR_SENSOR);
        lastSensorReading = currentReading;
        const char* initialState = (currentReading == LOW) ? "closed" : "open";
        Serial.printf("[WS] Syncing initial door state to cloud: %s\n", initialState);
        sendDoorTelemetry(initialState);
      }
      break;

    case WStype_TEXT:
      // Pass length for buffer overrun safety
      handleIncomingCommand(payload, length);
      break;

    case WStype_BIN:
      // Binary frames unused
      break;

    case WStype_ERROR:
      Serial.println("[WS] Connection Error!");
      break;

    default:
      break;
  }
}

// ==========================================
// INCOMING WEBSOCKET COMMAND PARSER
// ==========================================
void handleIncomingCommand(uint8_t * payload, size_t length) {
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, payload, length);

  if (error) {
    Serial.printf("[JSON] Parse error: %s (payload length: %u)\n", error.c_str(), (unsigned int)length);
    return;
  }

  Serial.printf("[WS] RX <- %.*s\n", (int)length, (char*)payload);

  const char* type = doc["type"];
  if (!type) return;

  // 1. Instant Unlock Push Command (<50ms response)
  // Supports both "UNLOCK" (direct deviceSocketService) and "UNLOCK_COMMAND" (broadcast)
  if (strcmp(type, "UNLOCK") == 0 || strcmp(type, "UNLOCK_COMMAND") == 0) {
    const char* cmdId = doc["commandId"] | "unknown_cmd";
    unsigned long duration = doc["duration"] | DEFAULT_UNLOCK_DURATION;

    // Safety clamp duration: min 100ms, max 5000ms
    if (duration > 5000) duration = 5000;
    if (duration < 100)  duration = DEFAULT_UNLOCK_DURATION;
    activeUnlockDuration = duration;

    Serial.printf("⚡ [UNLOCK] Real-time UNLOCK command received! CmdID: %s, Duration: %lums\n", cmdId, activeUnlockDuration);

    // Energize Solenoid Relay
    digitalWrite(PIN_ACTUATOR, HIGH);
    isUnlocking = true;
    unlockStartTime = millis();

    // Send immediate acknowledgment back to server
    JsonDocument ackDoc;
    ackDoc["type"] = "UNLOCK_ACK";
    ackDoc["commandId"] = cmdId;
    ackDoc["status"] = "SUCCESS";

    String ackPayload;
    serializeJson(ackDoc, ackPayload);
    webSocket.sendTXT(ackPayload);
    Serial.println("[WS] TX -> UNLOCK_ACK (SUCCESS) dispatched to Cloud.");
  }
  // 2. Heartbeat Acknowledgment
  else if (strcmp(type, "HEARTBEAT_ACK") == 0) {
    Serial.println("[HB] Heartbeat acknowledged by Cloud.");
  }
  // 3. Auth OK Handshake
  else if (strcmp(type, "AUTH_OK") == 0) {
    Serial.println("[AUTH] Device authenticated successfully with backend.");
  }
  // 4. Ping probe from server
  else if (strcmp(type, "PING") == 0) {
    webSocket.sendTXT("{\"type\":\"PONG\"}");
  }
}

// ==========================================
// SENSOR MONITORING & TELEMETRY
// ==========================================
void monitorSensor() {
  int reading = digitalRead(PIN_DOOR_SENSOR);

  if (reading != lastSensorReading && (millis() - lastDebounceTime > DEBOUNCE_DELAY)) {
    lastDebounceTime = millis();
    lastSensorReading = reading;

    // LOW = closed (catch engaged), HIGH = open (catch released / ajar)
    const char* stateStr = (reading == LOW) ? "closed" : "open";
    Serial.printf("\n[SENSOR] Physical state changed: %s\n", stateStr);
    sendDoorTelemetry(stateStr);
  }
}

void sendDoorTelemetry(const char* stateStr) {
  if (!isWsConnected) {
    Serial.println("[WARN] Cannot send telemetry: WebSocket not connected (state cached, will sync on reconnect).");
    return;
  }

  JsonDocument doc;
  doc["type"] = "TELEMETRY";
  doc["deviceId"] = DEVICE_ID;
  doc["doorState"] = stateStr;

  String payload;
  serializeJson(doc, payload);
  webSocket.sendTXT(payload);
  Serial.printf("[WS] TX -> TELEMETRY: Door is %s\n", stateStr);
}

// ==========================================
// HEARTBEAT TELEMETRY
// ==========================================
void sendHeartbeat() {
  if (!isWsConnected) return;

  JsonDocument doc;
  doc["type"] = "HEARTBEAT";
  doc["deviceId"] = DEVICE_ID;
  doc["rssi"] = WiFi.RSSI();
  doc["uptime"] = millis() / 1000;

  String payload;
  serializeJson(doc, payload);
  webSocket.sendTXT(payload);
  Serial.printf("[HB] TX -> Ping (RSSI: %d dBm, Uptime: %lus)\n", WiFi.RSSI(), millis() / 1000);
}

// ==========================================
// RELAY POWER PULSE TIMER
// ==========================================
void manageRelayTimer() {
  if (isUnlocking && (millis() - unlockStartTime >= activeUnlockDuration)) {
    digitalWrite(PIN_ACTUATOR, LOW); // Cut off 12V pulse to solenoid
    isUnlocking = false;
    Serial.printf("🔒 [RELAY] Relay pulse complete (%lums). Solenoid returned to catch position.\n", activeUnlockDuration);
  }
}