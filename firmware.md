# ESP32 Hardware Setup & Flashing Guide (WebSocket Edition)

This guide provides complete setup, wiring, architecture, and flashing instructions for the **Secure Box ESP32 WebSocket Firmware** (`firmware/src/websocket_firmware.cpp`), which connects directly to the backend real-time WebSocket gateway (`/ws/device`).

---

## 1. Migration Summary: HTTP Polling vs Real-Time WebSockets

| Metric / Feature | Legacy HTTP Polling (`src/main.cpp`) | WebSocket Firmware (`src/websocket_firmware.cpp`) |
| :--- | :--- | :--- |
| **Unlock Latency** | 0 to 1,500 ms (depends on poll cycle) | **< 50 ms** (instant sub-millisecond push dispatch) |
| **Network Overhead** | Continuous HTTP GET requests every 1.5s | Persistent TCP connection; low-bandwidth ping/telemetry |
| **Command Delivery** | Pull (`GET /api/device/command`) | **Push** via WebSocket (`UNLOCK` / `UNLOCK_COMMAND`) |
| **Telemetry & Heartbeats** | Multiple HTTP POST endpoints | Real-time bidirectional JSON frames over single socket |
| **Hardware Safety** | Blocking Wi-Fi retry could delay loop | **Non-blocking** timer ensures solenoid cut-off is never delayed |
| **Buffer Security** | Standard string deserialization | Bound-checked JSON deserialization (prevents memory overrun) |

---

## 2. Wiring & Pin Diagram

Connect the ESP32 pins to the Relay Module and Solenoid Lock feedback wire:

| Component | Component Wire / Pin | Connects to ESP32 Pin | Description |
| :--- | :--- | :--- | :--- |
| **Relay Module** | Signal (IN) | **GPIO 23** | Drives the 12V Solenoid pulse |
| **Relay Module** | VCC | **5V / VIN** | Power for relay coil |
| **Relay Module** | GND | **GND** | Shared ground |
| **Solenoid Sensor**| Feedback Signal Wire | **GPIO 22** | Senses door state (`INPUT_PULLUP`) |
| **Solenoid Sensor**| Sensor Ground Wire | **GND** | Shared ground |
| **External PSU** | 12V DC Supply | Solenoid Lock via Relay | Powers the latch mechanism |

> **Door Feedback Sensor Logic**:
> - **CLOSED / LOCKED**: Pin 22 pulled to **LOW** (GND).
> - **OPEN / UNLOCKED**: Pin 22 pulled to **HIGH** (3.3V via internal pull-up resistor).

---

## 3. PlatformIO Configuration (`platformio.ini`)

Add or select the `[env:websocket_firmware]` environment in `platformio.ini`:

```ini
[env:websocket_firmware]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
lib_deps = 
    bblanchon/ArduinoJson @ ^7.4.3
    links2004/WebSockets @ ^2.4.1
build_src_filter = +<websocket_firmware.cpp> -<main.cpp> -<circuit_test.cpp>
```

---

## 4. Configuration Variables

In [`src/websocket_firmware.cpp`](src/websocket_firmware.cpp), configure only these values:

```cpp
// 1. Wi-Fi Details
const char* WIFI_SSID     = "AibotInk_workshop";
const char* WIFI_PASSWORD = "Aibotink@123";

// 2. Server Host & Port (DO NOT prefix with http:// or ws://)
const char* SERVER_HOST   = "72.61.141.178";  // VPS Public IP or LAN IP
const int   SERVER_PORT   = 7000;             // Fastify server port

// 3. Unique Locker Identity & Provision Key (From Admin Dashboard)
const char* DEVICE_ID     = "BOX_WCUUY9";
const char* DEVICE_KEY    = "sbx_live_40435e76da3b2f52aad6321b60d3edc3";
```

---

## 5. Key Architecture & Safety Improvements Implemented

1. **Host Sanitization**:
   The firmware includes an automatic `sanitizeHost()` helper that strips leading `http://`, `https://`, `ws://`, trailing slashes, or accidental port suffixes, ensuring `WebSocketsClient` connects cleanly to the IP/hostname.

2. **Solenoid Coil Protection & Non-Blocking Wi-Fi**:
   In older revisions, a network drop during an unlock could block execution inside a `while` loop, keeping `PIN_ACTUATOR` energized for up to 15 seconds (burning out the 12V solenoid). In the updated code:
   - `manageRelayTimer()` executes **first** at the top of every `loop()` cycle.
   - Wi-Fi reconnection is handled non-blockingly via `maintainWiFi()`, allowing the relay timer and door sensor to run without interruption.

3. **Buffer Overrun Protection**:
   Incoming text payloads from `WebSocketsClient` are parsed using `deserializeJson(doc, payload, length)` with explicit length constraints, preventing heap/stack reads past buffer boundaries.

4. **Dual Command Type Support**:
   Accepts both direct WebSocket push (`"UNLOCK"`) and broadcast events (`"UNLOCK_COMMAND"`), extracting the command ID and returning an immediate `UNLOCK_ACK` frame to the cloud.

5. **State Synchronization on Reconnect**:
   When the WebSocket reconnects, the ESP32 automatically reads the physical GPIO 22 state and transmits a fresh `TELEMETRY` frame, ensuring the backend never stays out of sync if a physical state change occurred during network downtime.

6. **Wi-Fi Modem Sleep Disabled (`WiFi.setSleep(false)`)**:
   ESP32 enables modem sleep by default, which powers off the radio between DTIM beacons. Disabling sleep ensures the radio stays awake full-time for sub-50ms instant unlocks and immediate RFC 6455 Ping/Pong responses.

7. **Clean Socket Teardown on Wi-Fi Loss (`webSocket.disconnect()`)**:
   When Wi-Fi drops, `maintainWiFi()` immediately invokes `webSocket.disconnect()` to release the local TCP socket descriptor, preventing half-open zombie connections upon Wi-Fi recovery.

8. **Harmonized 10s Heartbeat & 30s Cloud Watchdog**:
   The ESP32 dispatches keepalive heartbeats every **10 seconds** (`HEARTBEAT_INTERVAL = 10000`). The backend watchdog sweeps every 5s and enforces a **30-second silence timeout**, giving a robust 3x margin of error that completely eliminates false disconnects from transient Wi-Fi jitter. Cloud push notifications enforce an additional **60-second grace period** to suppress alert flapping.

---

## 6. Complete ESP32 WebSocket Firmware Source Code

The full implementation is located at [`firmware/src/websocket_firmware.cpp`](firmware/src/websocket_firmware.cpp):

```cpp
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
const unsigned long HEARTBEAT_INTERVAL      = 10000; // Keep-alive ping every 10 seconds (aligned with backend)
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

  // Disable Wi-Fi modem sleep for real-time responsiveness & stable keepalive ping/pong
  WiFi.setSleep(false);

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
  webSocket.enableHeartbeat(15000, 5000, 3); // Native RFC 6455 ping/pong: 15s interval, 5s timeout, 3 retries
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

    // 5. Periodic Heartbeat frame (every 10 seconds)
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
    webSocket.disconnect(); // Cleanly resets local client state and frees TCP socket
    Serial.println("\n[WIFI] Wi-Fi lost! Disconnected WebSocket cleanly.");
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

    case WStype_PING:
      Serial.println("[WS] Native RFC 6455 PING received from server.");
      break;

    case WStype_PONG:
      Serial.println("[WS] Native RFC 6455 PONG received from server.");
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
    const char* cloudDoorState = doc["doorState"];
    if (cloudDoorState) {
      Serial.printf("[AUTH] Cloud DB door state synced: %s\n", cloudDoorState);
    }
  }
  // 4. Ping probe from server
  else if (strcmp(type, "PING") == 0) {
    webSocket.sendTXT("{\"type\":\"PONG\"}");
    lastHeartbeatTime = millis();
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
```

---

## 7. Hardware Verification Checklist

1. **Boot & Auth Handshake**:
   Open Serial Monitor at **115200 baud**. You should observe:
   ```text
   [WIFI] Connected! IP Address: 192.168.1.xxx | RSSI: -54 dBm
   [WS] Configuring connection to ws://72.61.141.178:7000/ws/device?deviceId=BOX_WCUUY9&deviceKey=sbx_live_...
   [WS] Connected to ws://72.61.141.178:7000/ws/device ✅
   [WS] Syncing initial door state to cloud: closed
   [WS] TX -> TELEMETRY: Door is closed
   [AUTH] Device authenticated successfully with backend.
   [AUTH] Cloud DB door state synced: closed
   ```

2. **Real-Time App Unlock Test**:
   - Slide to unlock on mobile app or trigger unlock in Admin portal.
   - Serial Monitor prints within **< 50 milliseconds**:
     ```text
     ⚡ [UNLOCK] Real-time UNLOCK command received! CmdID: cmd_xxx, Duration: 200ms
     [WS] TX -> UNLOCK_ACK (SUCCESS) dispatched to Cloud.
     🔒 [RELAY] Relay pulse complete (200ms). Solenoid returned to catch position.
     ```

3. **Door Push-to-Close Test**:
   - Push the physical door shut.
   - Serial Monitor prints:
     ```text
     [SENSOR] Physical state changed: closed
     [WS] TX -> TELEMETRY: Door is closed
     ```
   - Cloud portal updates locker status to "LOCKED" instantly.

4. **Heartbeat & Watchdog Test**:
   - Every **10 seconds**, the ESP32 dispatches:
     ```text
     [HB] TX -> Ping (RSSI: -52 dBm, Uptime: 45s)
     [HB] Heartbeat acknowledged by Cloud.
     ```
   - When native control frames are received from the server:
     ```text
     [WS] Native RFC 6455 PING received from server.
     ```
   - **Ungraceful Power Cut Test**: If the ESP32 loses power abruptly, the backend watchdog detects silence within **25–30 seconds** and updates MongoDB (`online: false`).
   - **Notification Grace**: If the device reconnects within 60 seconds, the pending FCM alert is cancelled; only sustained outages $\ge 60$s trigger an offline push notification.
