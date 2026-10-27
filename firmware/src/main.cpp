#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ==========================================
// 1. CONFIGURATION (EDIT THESE 5 VALUES)
// ==========================================
const char* WIFI_SSID     = "AibotInk_workshop";
const char* WIFI_PASSWORD = "Aibotink@123";
const char* API_BASE_URL  = "http://72.61.141.178:7000/api"; // Server Base URL
const char* DEVICE_ID     = "BOX_WCUUY9";                    // Alphanumeric Serial from Admin
const char* DEVICE_KEY    = "sbx_live_40435e76da3b2f52aad6321b60d3edc3";      // Secret Provision Key from Admin (or "SIMULATOR_TEST_KEY" for simulator)

// ==========================================
// 2. PIN DEFINITIONS
// ==========================================
const int PIN_ACTUATOR    = 23;  // Relay control (HIGH = 12V pulse)
const int PIN_DOOR_SENSOR = 22;  // Solenoid feedback wire

// Timing settings
const unsigned long UNLOCK_DURATION    = 200;   // 200ms power pulse to release latch
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
