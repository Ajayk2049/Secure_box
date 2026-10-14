# ESP32 Hardware Setup & Flashing Guide (WebSocket Edition)

This document is a direct, practical setup guide for the hardware team. Follow these steps to wire and flash the ESP32 for the **Secure Box** using **real-time WebSockets** (`/ws/device`).

---

## 1. Wiring & Pin Diagram

Connect the ESP32 pins to the Relay Module and Solenoid Lock feedback wire:

| Component | Component Wire / Pin | Connects to ESP32 Pin | Description |
| :--- | :--- | :--- | :--- |
| **Relay Module** | Signal (IN) | **GPIO 23** | Drives the 12V Solenoid power pulse |
| **Relay Module** | VCC | **5V / VIN** | Power for relay coil |
| **Relay Module** | GND | **GND** | Shared ground |
| **Solenoid Sensor**| Feedback Signal Wire | **GPIO 22** | Senses door locked/unlocked (`INPUT_PULLUP`) |
| **Solenoid Sensor**| Sensor Ground Wire | **GND** | Shared ground |
| **Power Supply** | 12V DC Supply | Solenoid Lock via Relay | Powers the latch mechanism |

> **Note on Door Sensor**: 
> - **CLOSED / LOCKED**: Pin 22 is pulled to **LOW** (GND).
> - **OPEN / UNLOCKED**: Pin 22 is **HIGH** (3.3V via internal pullup).

---

## 2. Required Libraries & Build Environment

The hardware runs exclusively on a standalone **ESP32 Development Board** (such as ESP32-WROOM-32, NodeMCU-32S, or ESP32-DevKitC) built using **VS Code with PlatformIO** with the `espressif32` platform.

### PlatformIO Configuration (`platformio.ini`)
Add these dependencies to your `platformio.ini` file:

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
upload_speed = 921600
lib_deps =
    links2004/WebSockets@^2.4.1
    bblanchon/ArduinoJson@^7.0.0
```

> **Libraries Used**:
> 1. **`WebSockets`** by *Markus Sattler* (`links2004/WebSockets@^2.4.1`): High-efficiency non-blocking WebSocket client for ESP32.
> 2. **`ArduinoJson`** by *Benoît Blanchon* (`bblanchon/ArduinoJson@^7.0.0`): Stream-based JSON parser and serializer.

---

## 3. Configuration Settings

In the C++ code below, configure only these **6 variables**:

```cpp
// 1. Wi-Fi Credentials
const char* WIFI_SSID     = "Your_WiFi_Name";
const char* WIFI_PASSWORD = "Your_WiFi_Password";

// 2. Server Host & Port (LAN IP or Public VPS IP)
const char* SERVER_HOST   = "192.168.1.100";  // Or your VPS IP: "103.xxx.xxx.xxx"
const int   SERVER_PORT   = 4300;             // Backend Fastify port

// 3. Unique Locker Identity & Key (Obtained from Admin Dashboard when locker is provisioned)
const char* DEVICE_ID     = "BOX_7K4M9Q";               // Alphanumeric Serial from Admin
const char* DEVICE_KEY    = "sbx_live_a1b2c3d4e5f6..."; // Secret Provision Key from Admin
```

---

## 4. Complete ESP32 C++ Code (`src/main.cpp`)

Save this complete code in `src/main.cpp` inside your PlatformIO project and upload it to your ESP32 board:

```cpp
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// ==========================================
// 1. CONFIGURATION (EDIT THESE 6 VALUES)
// ==========================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_HOST   = "192.168.1.100";  // LAN IP or VPS Public IP
const int   SERVER_PORT   = 4300;             // Port
const char* DEVICE_ID     = "BOX_7K4M9Q";     // Locker Serial from Admin
const char* DEVICE_KEY    = "sbx_live_a1b2c3d4e5f6..."; // Provision Key

// ==========================================
// 2. PIN DEFINITIONS
// ==========================================
const int PIN_ACTUATOR    = 23;  // Relay control (HIGH = 12V pulse)
const int PIN_DOOR_SENSOR = 22;  // Solenoid feedback wire (INPUT_PULLUP)

// Timing settings
const unsigned long UNLOCK_DURATION    = 3000;   // 3-second power pulse to release latch
const unsigned long HEARTBEAT_INTERVAL = 15000;  // Keep-alive ping every 15 seconds
const unsigned long DEBOUNCE_DELAY     = 60;     // Sensor debounce in ms

// Global Objects & State
WebSocketsClient webSocket;
unsigned long lastHeartbeatTime = 0;
unsigned long lastDebounceTime  = 0;
unsigned long unlockStartTime   = 0;
bool isUnlocking                = false;
int lastSensorReading           = -1;
bool isWsConnected              = false;

// Function declarations
void connectWiFi();
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length);
void handleIncomingCommand(const char* jsonStr);
void sendDoorTelemetry(const char* stateStr);
void sendHeartbeat();
void monitorSensor();
void manageRelayTimer();

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

  // Connect to Wi-Fi
  connectWiFi();

  // Configure WebSocket Client
  // Path includes credentials for immediate connection handshake
  String wsPath = "/ws/device?deviceId=" + String(DEVICE_ID) + "&deviceKey=" + String(DEVICE_KEY);
  webSocket.begin(SERVER_HOST, SERVER_PORT, wsPath.c_str());
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000); // Auto-reconnect every 3 seconds if disconnected
  webSocket.enableHeartbeat(15000, 3000, 2); // Native WebSocket ping/pong
}

void loop() {
  // 1. Maintain WebSocket connection loop
  webSocket.loop();

  // 2. Auto-reconnect Wi-Fi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    isWsConnected = false;
    connectWiFi();
    return;
  }

  // 3. Non-blocking relay pulse timer (turns off relay after 3 seconds)
  manageRelayTimer();

  // 4. Physical magnetic reed / solenoid sensor monitor with debounce
  monitorSensor();

  // 5. Periodic Heartbeat frame (every 15 seconds)
  if (isWsConnected && (millis() - lastHeartbeatTime > HEARTBEAT_INTERVAL)) {
    lastHeartbeatTime = millis();
    sendHeartbeat();
  }
}

// ==========================================
// WI-FI CONNECTION
// ==========================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("\n[WIFI] Connecting to SSID: %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 15000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Connected! IP Address: %s | RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("\n[WIFI] Connection Failed! Will retry in main loop...");
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
      Serial.printf("[WS] Connected to ws://%s:%d/ws/device ✅\n", SERVER_HOST, SERVER_PORT);

      // Report initial door sensor state immediately upon connection
      {
        int currentReading = digitalRead(PIN_DOOR_SENSOR);
        const char* initialState = (currentReading == LOW) ? "closed" : "open";
        sendDoorTelemetry(initialState);
      }
      break;

    case WStype_TEXT:
      Serial.printf("[WS] RX <- %s\n", (char*)payload);
      handleIncomingCommand((char*)payload);
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
void handleIncomingCommand(const char* jsonStr) {
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, jsonStr);

  if (error) {
    Serial.printf("[JSON] Parse error: %s\n", error.c_str());
    return;
  }

  const char* type = doc["type"];
  if (!type) return;

  // 1. Instant Unlock Push Command (<50ms response)
  if (strcmp(type, "UNLOCK") == 0) {
    const char* cmdId = doc["commandId"] | "unknown_cmd";
    unsigned long duration = doc["duration"] | UNLOCK_DURATION;

    Serial.printf("⚡ [UNLOCK] Real-time UNLOCK command received! CmdID: %s\n", cmdId);

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
  // 3. Auth OK
  else if (strcmp(type, "AUTH_OK") == 0) {
    Serial.println("[AUTH] Device authenticated successfully with backend.");
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
    Serial.println("[WARN] Cannot send telemetry: WebSocket not connected.");
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
  if (isUnlocking && (millis() - unlockStartTime >= UNLOCK_DURATION)) {
    digitalWrite(PIN_ACTUATOR, LOW); // Cut off 12V pulse
    isUnlocking = false;
    Serial.println("🔒 [RELAY] Relay pulse complete. Solenoid returned to catch position.");
  }
}
```

---

## 5. Hardware Verification Checklist

1. **Boot & Handshake**: Open Serial Monitor at **115200 baud**. You should see:
   ```text
   [WIFI] Connected! IP Address: 192.168.1.xxx | RSSI: -54 dBm
   [WS] Connected to ws://192.168.1.100:4300/ws/device ✅
   [AUTH] Device authenticated successfully with backend.
   [WS] TX -> TELEMETRY: Door is closed
   ```

2. **Real-Time App Unlock Test**:
   - Slide to unlock in the mobile app.
   - Within **under 50 milliseconds**, the Serial Monitor should print:
     ```text
     ⚡ [UNLOCK] Real-time UNLOCK command received! CmdID: cmd_172890123
     [WS] TX -> UNLOCK_ACK (SUCCESS) dispatched to Cloud.
     ```
   - The relay clicks **ON immediately**, stays on for **3 seconds**, and clicks **OFF**.

3. **Door Push-to-Close Test**:
   - Push the physical door shut until the latch clicks.
   - Serial Monitor prints:
     ```text
     [SENSOR] Physical state changed: closed
     [WS] TX -> TELEMETRY: Door is closed
     ```
   - Mobile app and Admin portal reflect "LOCKED" instantly without refreshing.

4. **Offline Detection Test**:
   - Unplug the ESP32 power.
   - The backend detects the socket closure **instantly** and marks the device offline in real time.
