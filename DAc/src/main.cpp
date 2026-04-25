#include <Arduino.h>
void setup() {
  Serial.begin(115200);
  
  // Set Pins 2-7 as outputs (Port D)
  DDRD |= B11111100; 
  // Set Pins 8-9 as outputs (Port B)
  DDRB |= B00000011; 
}

void loop() {
  if (Serial.available() > 0) {
    unsigned char sample = Serial.read();
    
    // 1. Send the bottom 6 bits to Pins 2-7
    // We shift left by 2 to skip Pins 0 and 1
    PORTD = (PORTD & B00000011) | (sample << 2);
    
    // 2. Send the top 2 bits to Pins 8 and 9
    // We shift right by 6 to bring the top bits to the bottom
    PORTB = (PORTB & B11111100) | (sample >> 6);
  }
}