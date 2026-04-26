import asyncio
import websockets
import json
import time
import requests
import os
from datetime import datetime

# ── Rendszer Konfiguráció ────────────────────────────────────────────────────
SERVO_ESP_IP = "192.168.145.204" 
WS_PORT = 8080
YOLO_JSON_PATH = "/Users/lorinczdora/Documents/sshfs/Projects/polihack2026/emergency_log.json"

# --- Végleges Kamera Stream URL ---
FINAL_STREAM_URL = "http://192.168.145.55:8080/stream"

# --- Szinkron Szervó Mozgató Függvény (hogy ne fagyassza le a WebSocketet) ---
def move_servo_sync(angle):
    try:
        requests.get(f"http://{SERVO_ESP_IP}/set?angle={angle}", timeout=2)
        print(f"📷 Szervó sikeresen mozgatva: {angle}°")
    except requests.exceptions.RequestException:
        print(f"⚠️ Nem sikerült elérni a szervót: {SERVO_ESP_IP}")

async def handle_connection(websocket):
    print("✅ Frontend (React) sikeresen csatlakozott a WebSockethez!")
    
    # 1. HÁTTÉRSZÁL: A YOLO fájl folyamatos figyelése
    async def watch_yolo_file():
        last_mtime = 0
        while True:
            try:
                if os.path.exists(YOLO_JSON_PATH):
                    current_mtime = os.path.getmtime(YOLO_JSON_PATH)
                    
                    if current_mtime > last_mtime:
                        # Ha a YOLO épp írja a fájlt, a json.load hibát dobhat. 
                        # A try-except megfogja, és a következő tizedmásodpercben újrapróbálja.
                        with open(YOLO_JSON_PATH, 'r', encoding='utf-8') as f:
                            raw_yolo_data = json.load(f)
                        
                        raw_ts = raw_yolo_data.get("timestamp")
                        try:
                            unix_ts = int(float(raw_ts))
                        except (ValueError, TypeError):
                            unix_ts = int(time.time())
                        
                        formatted_time = datetime.fromtimestamp(unix_ts).strftime('%H:%M:%S')
                        event_type = raw_yolo_data.get("event", "POSSIBLE_ATTACK")
                        camera_id = raw_yolo_data.get("camera_id", "cam_1")
                        people_cnt = raw_yolo_data.get("people", 0)

                        alert_data = {
                            "camera_id": camera_id,
                            "event": event_type,
                            "active": True,  
                            "timestamp": unix_ts, 
                            "time_string": formatted_time, 
                            "people": people_cnt,
                            "stream_url": FINAL_STREAM_URL
                        }
                        
                        # Szólunk a Reactnek, hogy mutassa a térképen
                        await websocket.send(json.dumps(alert_data))
                        print(f"🚨 Új Esemény! Idő: {formatted_time} - {event_type}")
                        
                        last_mtime = current_mtime
            except Exception:
                pass
            
            await asyncio.sleep(0.1)

    file_watcher_task = asyncio.create_task(watch_yolo_file())

    # 2. FŐSZÁL: A React-ből érkező parancsok figyelése
    try:
        async for message in websocket:
            try:
                command = json.loads(message)
                action = command.get("action")
                
                if action == "move_camera":
                    angle = command.get("angle")
                    # Szervó mozgatása külön szálon, teljesítményvesztés nélkül
                    asyncio.create_task(asyncio.to_thread(move_servo_sync, angle))
                        
                elif action == "simulate_alert":
                    alert_type = command.get("type")
                    camera_id = command.get("camera_id", "cam_1")
                    
                    unix_ts = int(time.time())
                    formatted_time = datetime.fromtimestamp(unix_ts).strftime('%H:%M:%S')

                    alert_data = {
                        "camera_id": camera_id,
                        "event": alert_type,
                        "active": True,
                        "timestamp": unix_ts,
                        "time_string": formatted_time,
                        "people": 2,
                        "stream_url": FINAL_STREAM_URL
                    }
                    
                    # Szimuláció kiküldése a Reactnek
                    await websocket.send(json.dumps(alert_data))

            except json.JSONDecodeError:
                pass
                
    except websockets.exceptions.ConnectionClosed:
        print("⚠️ A kliens lecsatlakozott.")
    finally:
        file_watcher_task.cancel() 

async def main():
    print(f"🚀 WebSocket szerver indul: ws://0.0.0.0:{WS_PORT}")
    async with websockets.serve(handle_connection, "0.0.0.0", WS_PORT):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())