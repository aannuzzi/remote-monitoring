#include <Adafruit_INA219.h>

#define FONA_PS 8
#define FONA_KEY 5

HardwareSerial *fonaSerial = &Serial1;

Adafruit_INA219 solar;
Adafruit_INA219 battery;
String fonaResponse = "";

typedef struct FONAResult {
  String response;
  boolean success;
} FONAResult;

void setup()
{
  // put your setup code here, to run once:
  Serial.begin(9600);
  Serial1.begin(9600);
  
  pinMode(FONA_PS, INPUT);
  pinMode(FONA_KEY, OUTPUT);  
  digitalWrite(FONA_KEY, HIGH);
  
  solar.begin();
  solar.setCalibration_SolarPanel();
  
  battery.begin(0x44);
  battery.setCalibration_SolarPanel();
}

void loop()
{  
  Serial.println("Started waiting...");
   
  turnFONAOn();
  delay(10000);
  flushFONA();
  
  sendCommand("AT+CSQ");
  
  float solarVoltage = 0;
  solarVoltage = solar.getBusVoltage_V();
  Serial.println("READ SOLAR waiting...");
  Serial.print("Measured bus voltage: ");
  Serial.println(solarVoltage);
  
  float solarCurrent = 0;
  solarCurrent = solar.getCurrent_mA();
  solarCurrent /= 1000.0;
  Serial.print("Measured current (A): ");
  Serial.println(solarCurrent);
  
  float batteryVoltage = 0;
  batteryVoltage = battery.getBusVoltage_V();
  Serial.println("\nREAD BATTERY waiting...");
  Serial.print("Measured bus voltage: ");
  Serial.println(batteryVoltage);
  
  float batteryCurrent = 0;
  batteryCurrent = battery.getCurrent_mA();
  batteryCurrent /= 1000.0;
  Serial.print("Measured current (A): ");
  Serial.println(batteryCurrent);
  Serial.println("");
  
  sendCommand("ATE0");
  
  // get the current time
  sendCommand("AT+CCLK?");
  int firstNdx = fonaResponse.indexOf('\"') + 1;
  int lastNdx = fonaResponse.lastIndexOf(':') + 3; // get the last : and include the seconds but substring is exclusive
  String urlSafeTime = fonaResponse.substring(firstNdx, lastNdx);
  Serial.print("Unsafe TIME: ");
  Serial.println(urlSafeTime);
  urlSafeTime.replace("/", "%2F");
  urlSafeTime.replace(",", "%2C");
  urlSafeTime.replace(":", "%3A");
  Serial.print("  Safe TIME ");
  Serial.println(urlSafeTime);
  
  
  sendCommand("AT+CGATT=1");
  sendCommand("AT+SAPBR=3,1,\"CONTYPE\",\"GPRS\"");
  sendCommand("AT+SAPBR=3,1,\"APN\",\"epc.tmobile.com\"");
  sendCommand("AT+SAPBR=1,1");
  sendCommand("AT+HTTPINIT");
  sendCommand("AT+HTTPPARA=\"CID\",1");
  
  String httpCommand = "AT+HTTPPARA=\"URL\",\"http://annuzzi-monitor.herokuapp.com/data?time=";
  httpCommand.concat(urlSafeTime);
  httpCommand.concat("&battVolt=");
  httpCommand.concat(batteryVoltage);
  httpCommand.concat("&battCur=");
  httpCommand.concat(batteryCurrent);
  httpCommand.concat("&solarVolt=");
  httpCommand.concat(solarVoltage);
  httpCommand.concat("&solarCur=");
  httpCommand.concat(solarCurrent);
  httpCommand.concat("\"");
 
  sendCommand(httpCommand);
  sendCommand("AT+HTTPACTION=0", 2);
  sendCommand("AT+HTTPREAD", 1);
  sendCommand("AT+HTTPTERM");
  sendCommand("AT+SAPBR=0,1");
  
  turnFONAOff();
  
  delay(30000); // wait 30s
  
}

void sendCommand(String s) {
  sendCommand(s, 1); 
}

void sendCommand(String s, int numResponse) {
  FONAResult result;
  flushFONA();
  Serial.print("Sending request: ");
  Serial.println(s);
  
  fonaSerial->println(s);
  
  while (numResponse > 0) {
    // check every 100ms if there is data
    int x = 0;
    while(!fonaSerial->available() && x <= 100) {
      x++;
      delay(100);
    }
    
    fonaResponse = "";
    Serial.print("Response: ");
    while(fonaSerial->available()) {
      char c = fonaSerial->read();
      if (c != 0x0A && c != 0x0D) {
        fonaResponse.concat(c);
        Serial.print(c);
      }
    }
    Serial.println("");
    Serial.println(fonaResponse);
    numResponse--;
  }
  delay(1000);
}

void flushFONA() {
  fonaSerial->flush();
}

void turnFONAOn() {
  if (digitalRead(FONA_PS)) {
    Serial.println("FONA is ON"); 
  } else {
      Serial.print("Turning on...");
      digitalWrite(FONA_KEY, LOW);
      delay(2000);
      digitalWrite(FONA_KEY, HIGH);
      Serial.println("success");
  }
}

void turnFONAOff() {
  if (!digitalRead(FONA_PS)) {
    Serial.println("FONA is OFF"); 
  } else {
      Serial.print("Turning off...");
      digitalWrite(FONA_KEY, LOW);
      delay(2000);
      digitalWrite(FONA_KEY, HIGH);
      Serial.println("success");
  }
}