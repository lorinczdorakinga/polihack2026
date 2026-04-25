import serial
import time

# Update to your correct port
ser = serial.Serial('/dev/ttyUSB1', 115200) 
time.sleep(2)

with open("output.raw", "rb") as f:
    data = f.read()
    
print("Playing 8-bit Audio...")
start_time = time.time()
for i, byte in enumerate(data):
    ser.write(bytes([byte]))
    
    # Timing for 8000Hz (125 microseconds)
    expected_time = start_time + (i * 0.000125)
    while time.time() < expected_time:
        pass
