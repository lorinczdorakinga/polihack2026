#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <Servo.h>

// Wi-Fi adatok
const char* ssid = "Moto edge x30";
const char* password = "1234567890";

ESP8266WebServer server(80);
Servo myServo;

// Lábak
const int servoPin = 2; 
const int micPin = 13;

// Szervó változók a lassan mozgáshoz
int currentAngle = 0;
int targetAngle = 0;
unsigned long lastServoStepTime = 0;
const int servoStepInterval = 15; // Itt állítod a sebességet (ms). Minél nagyobb, annál lassabb.

// Mikrofon változók
bool bummTortent = false;

// Interrupt függvény a mikrofonhoz (Digitális lábhoz)
ICACHE_RAM_ATTR void handleMicInterrupt() {
  bummTortent = true;
}

void setup() {
  Serial.begin(115200);
  myServo.attach(servoPin);
  myServo.write(currentAngle);

  pinMode(micPin, INPUT);
  // Hardveres interrupt a mikrofonnak: azonnal elkapja a zajt
  attachInterrupt(digitalPinToInterrupt(micPin), handleMicInterrupt, RISING);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  
  Serial.println("\nIP: " + WiFi.localIP().toString());

  // Végpont: csak beállítja a cél-szöget, nem várakozik!
  server.on("/set", []() {
    if (server.hasArg("angle")) {
      targetAngle = server.arg("angle").toInt();
      server.send(200, "text/plain", "Cél beállítva: " + String(targetAngle));
    }
  });

  server.on("/check_bumm", []() {
    if (bummTortent) {
      server.send(200, "text/plain", "IGEN");
      bummTortent = false;
    } else {
      server.send(200, "text/plain", "NEM");
    }
  });

  server.begin();
}

void loop() {
  server.handleClient();

  // --- SZERVÓ MOZGATÁS DELAY NÉLKÜL ---
  // Megnézzük, eltelt-e már elég idő az utolsó kis mozdulat óta
  if (millis() - lastServoStepTime >= servoStepInterval) {
    if (currentAngle != targetAngle) {
      if (currentAngle < targetAngle) {
        currentAngle++;
      } else {
        currentAngle--;
      }
      myServo.write(currentAngle);
      lastServoStepTime = millis(); // Frissítjük az időbélyeget
    }
  }

  // Itt a loop fut tovább, a mikrofon és a szerver azonnal reagál!
}