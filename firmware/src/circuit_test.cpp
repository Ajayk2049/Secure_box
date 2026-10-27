#include <WiFi.h>

const char *WIFI_SSID = "AibotInk_workshop";
const char *WIFI_PASS = "Aibotink@123";

const int dl_pin = 23;
const int ds_pin = 22;

bool current_lock_status = HIGH; // Lock Open == HIGH
bool previous_lock_status = HIGH;

void setup()
{
    Serial.begin(115200);
    pinMode(dl_pin, OUTPUT);
    pinMode(ds_pin, INPUT_PULLUP);

    Serial.printf("Connecting to WiFi: %s ", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }
    Serial.printf("\nWiFi Connected! IP: %s\n", WiFi.localIP().toString().c_str());
}

void loop()
{
    current_lock_status = digitalRead(ds_pin);

    if (current_lock_status != previous_lock_status)
    {
        Serial.printf("Lock status changed to %s\n",
                      current_lock_status ? "HIGH" : "LOW");

        if (current_lock_status == LOW)
        {
            Serial.println("Door locked. Triggering unlock in 3 seconds");

            delay(3000);

            digitalWrite(dl_pin, HIGH);
            delay(250);
            digitalWrite(dl_pin, LOW);

            Serial.println("Door unlocked");
        }

        previous_lock_status = current_lock_status;
    }

    delay(200);
}
