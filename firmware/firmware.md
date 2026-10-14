# ESP32 Hardware Setup & Flashing Guide

This document is a direct, practical setup guide for the hardware team. Follow these steps to wire and flash the ESP32 for the **Secure Box**.

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

## 2. Configuration Settings

In the C++ code below, configure only these **5 variables**:

```cpp
// 1. Your Wi-Fi Details
const char* WIFI_SSID     = "Your_WiFi_Name";
const char* WIFI_PASSWORD = "Your_WiFi_Password";

// 2. Server URL (Replace with your server IP or domain)
const char* API_BASE_URL  = "http://192.168.0.100:4300/api";

// 3. Unique Locker Identity & Key (Obtained from Admin Dashboard when order is accepted)
const char* DEVICE_ID     = "BOX_7K4M9Q";                     // Unguessable alphanumeric serial from Admin
const char* DEVICE_KEY    = "sbx_live_a1b2c3d4e5f6...";       // Secret Provision Key from Admin
```

---

## 3. Complete ESP32 Code (Copy & Flash)

Paste this complete code into **Arduino IDE** or **PlatformIO**, install the **ArduinoJson** library (v7 or v6), and flash it to the ESP32.

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ==========================================
// 1. CONFIGURATION (EDIT THESE 5 VALUES)
// ==========================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* API_BASE_URL  = "http://192.168.1.100:4300/api"; // Server Base URL
const char* DEVICE_ID     = "BOX_7K4M9Q";                    // Alphanumeric Serial from Admin
const char* DEVICE_KEY    = "sbx_live_a1b2c3d4e5f6...";      // Secret Provision Key from Admin (or "SIMULATOR_TEST_KEY" for simulator)

// ==========================================
// 2. PIN DEFINITIONS
// ==========================================
const int PIN_ACTUATOR    = 23;  // Relay control (HIGH = 12V pulse)
const int PIN_DOOR_SENSOR = 22;  // Solenoid feedback wire

// Timing settings
const unsigned long UNLOCK_DURATION    = 3000;   // 3-second power pulse to release latch
const unsigned long POLL_INTERVAL      = 1500;   // Check for unlock every 1.5 seconds
const unsigned long HEARTBEAT_INTERVAL = 15000;  // Keep-alive ping every 15 seconds
const unsigned long DEBOUNCE_DELAY     = 60;     // Sensor debounce in ms

// Runtime state
WiFiClient client;
unsigned long lastPollTime      = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastDebounceTime  = 0;
unsigned long unlockStartTime   = 0;
bool isUnlocking                = false;
int lastSensorReading           = -1;

// Function declarations
void connectWiFi();
void checkUnlockCommand();
void sendDoorStatus(const char* stateStr);
void sendHeartbeat();
void monitorSensor();
void manageRelayTimer();

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Configure Pins
  pinMode(PIN_ACTUATOR, OUTPUT);
  digitalWrite(PIN_ACTUATOR, LOW); // Keep locked initially

  pinMode(PIN_DOOR_SENSOR, INPUT_PULLUP);

  // Connect to Wi-Fi
  connectWiFi();

  // Read initial sensor state and sync with server immediately
  int initialReading = digitalRead(PIN_DOOR_SENSOR);
  lastSensorReading = initialReading;
  const char* initialState = (initialReading == LOW) ? "closed" : "open";
  Serial.printf("Initial Door State: %s\n", initialState);
  sendDoorStatus(initialState);
}

void loop() {
  // Auto-reconnect Wi-Fi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // 1. Non-blocking 3-second relay timer
  manageRelayTimer();

  // 2. Monitor physical door switch
  monitorSensor();

  // 3. Poll for app unlock commands (every 1.5s)
  if (millis() - lastPollTime >= POLL_INTERVAL) {
    lastPollTime = millis();
    checkUnlockCommand();
  }

  // 4. Heartbeat ping (every 15s)
  if (millis() - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    lastHeartbeatTime = millis();
    sendHeartbeat();
  }
}

// -------------------------------------------------------------
// HELPER FUNCTIONS
// -------------------------------------------------------------

void connectWiFi() {
  Serial.printf("Connecting to Wi-Fi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nWi-Fi Connected! IP: %s\n", WiFi.localIP().toString().c_str());
}

void manageRelayTimer() {
  if (isUnlocking && (millis() - unlockStartTime >= UNLOCK_DURATION)) {
    digitalWrite(PIN_ACTUATOR, LOW);
    isUnlocking = false;
    Serial.println("Relay OFF (Latch locked, ready for push-to-lock).");
  }
}

void checkUnlockCommand() {
  HTTPClient http;
  char url[128];
  snprintf(url, sizeof(url), "%s/device/command?deviceId=%s", API_BASE_URL, DEVICE_ID);

  http.begin(client, url);
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);

  int httpCode = http.GET();
  if (httpCode == 200) {
    String payload = http.getString();
    JsonDocument doc;
    deserializeJson(doc, payload);

    const char* action = doc["action"];
    if (action && strcmp(action, "unlock") == 0) {
      Serial.println("⚡ UNLOCK COMMAND RECEIVED! Activating relay for 3s...");
      digitalWrite(PIN_ACTUATOR, HIGH);
      isUnlocking = true;
      unlockStartTime = millis();
    }
  }
  http.end();
}

void sendDoorStatus(const char* stateStr) {
  HTTPClient http;
  char url[128];
  snprintf(url, sizeof(url), "%s/device/telemetry", API_BASE_URL);

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);

  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["doorState"] = stateStr;

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);
  Serial.printf("Door state [%s] reported to server. HTTP Code: %d\n", stateStr, httpCode);
  http.end();
}

void sendHeartbeat() {
  HTTPClient http;
  char url[128];
  snprintf(url, sizeof(url), "%s/device/heartbeat", API_BASE_URL);

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);

  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);
  if (httpCode == 200) {
    Serial.println("Heartbeat ping OK (Online).");
  }
  http.end();
}

void monitorSensor() {
  int reading = digitalRead(PIN_DOOR_SENSOR);

  if (reading != lastSensorReading && (millis() - lastDebounceTime > DEBOUNCE_DELAY)) {
    lastDebounceTime = millis();
    lastSensorReading = reading;

    // LOW = closed, HIGH = open
    const char* stateStr = (reading == LOW) ? "closed" : "open";
    Serial.printf("Physical sensor state changed: %s\n", stateStr);
    sendDoorStatus(stateStr);
  }
}
```

---

## 4. Hardware Verification Checklist

1. **Boot**: Open Serial Monitor at **115200 baud**. You should see:
   ```text
   Wi-Fi Connected! IP: 192.168.1.xxx
   Initial Door State: closed
   ```
2. **App Unlock Test**: Slide to unlock in the mobile app. The relay should click **ON for 3 seconds** and then turn **OFF**.
3. **Push-to-Lock Test**: Physically push the door shut until the latch clicks. Serial monitor should print:
   ```text
   Physical sensor state changed: closed
   Door state [closed] reported to server. HTTP Code: 200
   ```
4. **Emergency Unlock Test**: Use the manual key or lever to open the door. Serial monitor should immediately report:
   ```text
   Physical sensor state changed: open
   Door state [open] reported to server. HTTP Code: 200
   ```
