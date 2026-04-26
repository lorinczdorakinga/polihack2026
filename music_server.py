import json
import time
import os
import subprocess

FILE_PATH = "emergency_log.json"

# Track the state
last_event = None
last_mtime = 0

def emergency_call(alert_type):
    """Generates the appropriate warning text and triggers the audio script."""
    
    # 1. Write the dynamic message based on the event type
    with open("output.txt", "w", encoding="utf-8") as f:
        if alert_type in ["FIGHT_DETECTED", "PANIC_DETECTED"]:
            f.write("Attention! Police have been notified and are on the way. Please remain calm, step back, and do not leave the area.")

        elif alert_type in ["FIRE_EVENT", "SMOKE_EVENT"]:
            f.write("Fire emergency detected! Please evacuate the area immediately. Use the nearest safe exit. Move away from the danger zone.")

        elif alert_type == "HEALTH_EMERGENCY":
            # Itt van az elsősegély nyújtási útmutató is
            f.write("Stay with the patient until paramedics arrive.")
        else:
            f.write("Emergency detected. Please remain calm and await instructions.")

    # 2. Launch the bash script in the background
    try:
        subprocess.Popen(["bash", "music.sh"])
        print(f"A music.sh sikeresen lefutott a következő eseményre: {alert_type}")
    except Exception as e:
        print(f"Hiba történt a music.sh indításakor: {e}")


print(f"👁️  Monitoring {FILE_PATH} for event changes...")

while True:
    try:
        # Check if the file has been modified
        current_mtime = os.path.getmtime(FILE_PATH)
        
        if current_mtime > last_mtime:
            last_mtime = current_mtime
            
            # Open and read the JSON
            with open(FILE_PATH, "r") as file:
                data = json.load(file)
                
            current_event = data.get("event")
            
            # Trigger logic if the event changed
            if current_event != last_event:
                print(f"🚨 NEW EVENT DETECTED: {current_event} (Previously: {last_event})")
                
                CRITICAL_EVENTS = [
                    "HEALTH_EMERGENCY", "FIRE_EVENT", "SMOKE_EVENT", 
                    "FIGHT_DETECTED", "PANIC_DETECTED"
                ]
                
                if current_event in CRITICAL_EVENTS:
                    print(f"🔊 Launching emergency audio sequence...")
                    emergency_call(current_event)

                last_event = current_event

    except FileNotFoundError:
        pass
    except json.JSONDecodeError:
        pass
        
    time.sleep(1.0)
