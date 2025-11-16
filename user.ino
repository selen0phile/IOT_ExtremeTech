#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>

const char *WIFI_SSID = "Aula_416";
const char *WIFI_PASS = "sanaance";
const char *WS_HOST = "192.168.0.5";  // backend IP
const uint16_t WS_PORT = 8080;
const char *WS_PATH = "/";

int activeBlock = -1;  // 0,1,2

double pickup_lat = 23.725133;
double pickup_lng = 90.392916;

// 0 right, 1 left, 2 other
double dest_lat[3] = { 23.725210, 23.724937, 40.725210 };
double dest_lng[3] = { 90.392553, 90.393496, 70.392553 };

unsigned long presence_reqd = 3000UL;
unsigned long laser_verification = 500UL;
unsigned long button_debounce = 50UL;
unsigned long button_double_ignore = 2000UL;
unsigned long total_search_timeout = 60000UL;
unsigned long sonar_interval = 90UL;

int max_dist = 100;
int pingPin[3] = { 19, 5, 2 };
int echoPin[3] = { 18, 4, 15 };

int ldr = 36;
int buttonPin = 23;

const int YELLOW_PIN = 32;  // searching
const int GREEN_PIN = 33;   // accepted
const int RED_PIN = 25;     // failure
int buzzerPin = 14;

Adafruit_SH1106G display = Adafruit_SH1106G(128, 64, &Wire, -1);

WebSocketsClient webSocket;

enum BlockState {
  IDLE,
  PRESENCE_CONFIRMED,
  VERIFIED,
  REQUEST_SENT,
  WAITING_PULLER,
  ACCEPTED,
  TIMEOUT_FAILED
};
BlockState state = IDLE;

unsigned long presenceStart[3] = { 0, 0, 0 };
bool laserActive = false;
unsigned long laserStart = 0;

bool lastBtnState = HIGH;
unsigned long lastBtnChange = 0;
unsigned long lastConfirmTime = 0;

int sonarIndex = 0;
unsigned long lastSonarMillis = 0;

unsigned long requestSentAt = 0;

void oledShow(const char *a, const char *b = "", const char *c = "") {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.setTextColor(SH110X_WHITE);
  display.println(a);
  if (b && strlen(b)) display.println(b);
  if (c && strlen(c)) display.println(c);
  display.display();
}

void beep(int times = 1, int onMs = 80, int offMs = 80) {
  for (int i = 0; i < times; i++) {
    digitalWrite(buzzerPin, HIGH);
    delay(onMs);
    digitalWrite(buzzerPin, LOW);
    if (i < times - 1) delay(offMs);
  }
}

void setColorLed(const char *color, bool on) {
  if (strcmp(color, "yellow") == 0) {
    digitalWrite(YELLOW_PIN, on ? HIGH : LOW);
    if (on) {
      digitalWrite(GREEN_PIN, LOW);
      digitalWrite(RED_PIN, LOW);
    }
  } else if (strcmp(color, "green") == 0) {
    digitalWrite(GREEN_PIN, on ? HIGH : LOW);
    if (on) {
      digitalWrite(YELLOW_PIN, LOW);
      digitalWrite(RED_PIN, LOW);
    }
  } else if (strcmp(color, "red") == 0) {
    digitalWrite(RED_PIN, on ? HIGH : LOW);
    if (on) {
      digitalWrite(YELLOW_PIN, LOW);
      digitalWrite(GREEN_PIN, LOW);
    }
  }
}

void setAllLedsOff() {
  digitalWrite(YELLOW_PIN, LOW);
  digitalWrite(GREEN_PIN, LOW);
  digitalWrite(RED_PIN, LOW);
}

long sonarCM(int pingP, int echoP) {
  digitalWrite(pingP, LOW);
  delayMicroseconds(2);
  digitalWrite(pingP, HIGH);
  delayMicroseconds(10);
  digitalWrite(pingP, LOW);
  long duration = pulseIn(echoP, HIGH, 30000);
  if (duration == 0)
    return 9999;
  long cm = duration / 29 / 2;
  return cm;
}

void sendWS(String payload) {
  if (webSocket.isConnected()) {
    webSocket.sendTXT(payload);
  } else {
    oledShow("WS not connected", "Message dropped");
    Serial.println("WS not connected — message dropped:");
    Serial.println(payload);
  }
}

void sendRideRequest() {
  int finalCm = (int)sonarCM(pingPin[activeBlock], echoPin[activeBlock]);

  StaticJsonDocument<256> doc;
  JsonObject loc = doc.createNestedObject("location");
  loc["lat"] = pickup_lat;
  loc["lng"] = pickup_lng;

  JsonObject dest = doc.createNestedObject("destination");
  dest["lat"] = dest_lat[activeBlock];
  dest["lng"] = dest_lng[activeBlock];

  String out;
  serializeJson(doc, out);
  Serial.println(out);

  sendWS(out);

  requestSentAt = millis();
  state = REQUEST_SENT;
  oledShow("Request sent", "Waiting for rickshaw...");
  setColorLed("yellow", true);
}


void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected");
      oledShow("WS disconnected");
      setAllLedsOff();
      break;

    case WStype_CONNECTED:
      {
        Serial.println("[WS] Connected");
        oledShow("WS connected");
        // {
        //   StaticJsonDocument<128> iddoc;
        //   iddoc["type"] = "identify";
        //   iddoc["block_idx"] = block_idx;
        //   String idStr; serializeJson(iddoc, idStr);
        //   webSocket.sendTXT(idStr);
        // }
        break;
      }

    case WStype_TEXT:
      {
        String raw;
        raw.reserve(length + 1);
        for (size_t i = 0; i < length; i++)
          raw += (char)payload[i];
        Serial.print("[WS] Received: ");
        Serial.println(raw);
        // short message on OLED
        // oledShow("WS message", raw.substring(0, 20).c_str());
        // oledShow("WS message", raw.c_str());

        StaticJsonDocument<256> doc;
        DeserializationError err = deserializeJson(doc, raw);
        if (err) break;
        
        const char *typeStr = doc["type"];
        if (typeStr && strcmp(typeStr, "ping") == 0) {
          StaticJsonDocument<64> r;
          r["type"] = "pong";
          r["block"] = activeBlock >= 0 ? activeBlock : -1;
          String out;
          serializeJson(r, out);
          webSocket.sendTXT(out);
          break;
        }

        if (doc.containsKey("message")) {
          const char *msg = doc["message"];
          if (msg) {
            oledShow(msg);
            char c = msg[0];
            if (c == 'D') {
              state = ACCEPTED;
              setAllLedsOff();
              setColorLed("green", true);
            } else if (c == 'A') {
              state = IDLE;
              setAllLedsOff();
            } else if (c == 'N') {
              state = TIMEOUT_FAILED;
              setAllLedsOff();
              setColorLed("red", true);
            }
          }
        }

        // if (doc.containsKey("status")) {
        //   const char *status = doc["status"];
        //   if (strcmp(status, "assigned") == 0 || strcmp(status, "searching") == 0) {
        //     state = WAITING_PULLER;
        //     oledShow("Searching for puller", "...");
        //     // indicate searching with yellow
        //     setColorLed("yellow", true);
        //   } else if (strcmp(status, "accepted") == 0) {
        //     state = ACCEPTED;
        //     oledShow("Accepted", "");
        //     beep(2, 80, 80);
        //     setColorLed("green", true);
        //   } else if (strcmp(status, "no_puller") == 0 || strcmp(status, "rejected") == 0) {
        //     state = TIMEOUT_FAILED;
        //     oledShow("No puller found", "");
        //     beep(1, 200, 50);
        //     setColorLed("red", true);
        //   } else if (strcmp(status, "complete") == 0 || strcmp(status, "reset") == 0) {
        //     state = IDLE;
        //     oledShow("Complete", "");
        //     setAllLedsOff();
        //     activeBlock = -1;
        //   }
        // }

        break;
      }

    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(50);

  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(buzzerPin, OUTPUT);
  for (int i = 0; i < 3; i++) {
    pinMode(pingPin[i], OUTPUT);
    pinMode(echoPin[i], INPUT);
  }
  
  pinMode(YELLOW_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(RED_PIN, OUTPUT);
  setAllLedsOff();

  if (!display.begin(0x3C, true)) {
    Serial.println(F("SH1106G allocation failed"));
    for (;;)
      ;
  }


  // WiFi
  oledShow("Connecting WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000)
    delay(200);
  if (WiFi.status() == WL_CONNECTED) {
    oledShow("WiFi connected", WiFi.localIP().toString().c_str());
  } else {
    oledShow("WiFi failed", "Offline mode");
  }

  // WebSocket
  webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);

  state = IDLE;
}

void loop() {
  webSocket.loop();
  unsigned long now = millis();

  if (now - lastSonarMillis >= sonar_interval) {
    lastSonarMillis = now;
    int i = sonarIndex;
    long cm = sonarCM(pingPin[i], echoPin[i]);

    if (cm <= max_dist) {
      if (presenceStart[i] == 0) {
        presenceStart[i] = now;
        Serial.print("sonar ");
        Serial.print(i);
        Serial.println(" first in-range");
      } else {
        unsigned long elapsed = now - presenceStart[i];
        if (elapsed >= presence_reqd) {
          if (state == IDLE) {
            activeBlock = i;
            state = PRESENCE_CONFIRMED;
            char buf2[16];
            snprintf(buf2, sizeof(buf2), "block %d", activeBlock);
            oledShow("Stand detected", buf2);
            // setColorLed("yellow", true);
            beep(1, 40, 0);
            Serial.print("sonar ");
            Serial.print(i);
            Serial.println(" confirmed (PRESENCE_CONFIRMED)");
          }
        }
      }
    }
    else {
      if (presenceStart[i] != 0) {
        Serial.print("sonar ");
        Serial.print(i);
        Serial.println(" out-of-range -> reset");
      }
      presenceStart[i] = 0;
      if (i == activeBlock) {
        if (state != REQUEST_SENT && state != WAITING_PULLER && state != ACCEPTED) {
          state = IDLE;
          oledShow("Idle");
          setAllLedsOff();
          activeBlock = -1;
        } else {
          if ((state == REQUEST_SENT || state == WAITING_PULLER) && (now - requestSentAt < total_search_timeout)) {
            StaticJsonDocument<128> doc;
            doc["type"] = "cancel";
            doc["block"] = activeBlock;
            doc["reason"] = "user_left";
            String s;
            serializeJson(doc, s);
            sendWS(s);
            state = IDLE;
            oledShow("Cancelled");
            setColorLed("red", true);
            activeBlock = -1;
          }
        }
      }
      else { }
    }

    sonarIndex = (sonarIndex + 1) % 3;
  }

  if (state == PRESENCE_CONFIRMED) {
    int v = analogRead(ldr);
    if (v == 0) {
      if (!laserActive) {
        laserActive = true;
        laserStart = now;
      } else {
        if (now - laserStart >= laser_verification) {
          state = VERIFIED;
          oledShow("Verified", "Press CONFIRM");
          beep(1, 80, 50);
          laserActive = false;
        }
      }
    }
    else laserActive = false;
  }
  else if (state == VERIFIED) {
    oledShow("Verified", "Press CONFIRM");
  }

  // button debounced reading
  int curr = digitalRead(buttonPin);
  bool btnPressed = false;
  if (curr != lastBtnState) {
    lastBtnChange = now;
    lastBtnState = curr;
  } else {
    if (now - lastBtnChange > button_debounce)
      btnPressed = (curr == LOW);
  }

  if ((state == VERIFIED || state == TIMEOUT_FAILED) && btnPressed) {
    if (now - lastConfirmTime > button_double_ignore) {
      sendRideRequest();
      lastConfirmTime = now;
    }
  }

  // if (state == WAITING_PULLER) {
  //   if (now - requestSentAt >= total_search_timeout) {
  //     state = TIMEOUT_FAILED;
  //     oledShow("No puller found");
  //     if (activeBlock >= 0) {
  //       // setAllLedsOff();
  //       // setColorLed("red", true); 
  //     }
  //     if (activeBlock >= 0) {
  //       StaticJsonDocument<128> doc;
  //       doc["type"] = "timeout";
  //       doc["block"] = activeBlock;
  //       String s;
  //       serializeJson(doc, s);
  //       sendWS(s);
  //     }
  //   }
  // }

  delay(8);
}