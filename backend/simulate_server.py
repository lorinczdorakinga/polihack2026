import asyncio
import websockets
import json
import time
import requests
import os
from datetime import datetime # <-- Új import a dátumkezeléshez!

SERVO_ESP_IP = "192.168.1.100" 
WS_PORT = 8080
YOLO_JSON_PATH = "/Users/lorinczdora/Documents/sshfs/Projects/polihack2026/emergency_log.json"

async def handle_connection(websocket):
    print("✅ Frontend (React) sikeresen csatlakozott a WebSockethez!")
    
    async def watch_yolo_file():
        last_mtime = 0
        while True:
            try:
                if os.path.exists(YOLO_JSON_PATH):
                    current_mtime = os.path.getmtime(YOLO_JSON_PATH)
                    
                    if current_mtime > last_mtime:
                        with open(YOLO_JSON_PATH, 'r', encoding='utf-8') as f:
                            raw_yolo_data = json.load(f)
                        
                        # --- IDŐBÉLYEG KONVERTÁLÁSA ---
                        yolo_time_str = raw_yolo_data.get("timestamp", "")
                        try:
                            # Szöveg (ISO formátum) átalakítása másodperc alapú Unix számmá
                            dt = datetime.fromisoformat(yolo_time_str)
                            unix_ts = int(dt.timestamp())
                        except (ValueError, TypeError):
                            # Biztonsági háló: ha hibás a YOLO szövege, a mostani időt használjuk
                            unix_ts = int(time.time())
                        
                        # --- ADATTISZTÍTÁS ---
                        alert_data = {
                            "camera_id": raw_yolo_data.get("camera_id", "cam_1"),
                            "event": raw_yolo_data.get("event", "POSSIBLE_ATTACK"),
                            "active": True,  
                            "timestamp": unix_ts, # <-- Most már a YOLO pontos idejét küldjük számként!
                            "people": raw_yolo_data.get("people", 0),
                            "stream_url": "http://192.168.54.252/stream" 
                        }
                        
                        await websocket.send(json.dumps(alert_data))
                        print("🚨 Emergency event!")
                        print(f"📦 Data: {alert_data}")
                        
                        last_mtime = current_mtime
            except Exception as e:
                pass
            
            await asyncio.sleep(0.001)

    file_watcher_task = asyncio.create_task(watch_yolo_file())

    try:
        async for message in websocket:
            try:
                command = json.loads(message)
                action = command.get("action")
                
                if action == "move_camera":
                    angle = command.get("angle")
                    try:
                        requests.get(f"http://{SERVO_ESP_IP}/set?angle={angle}", timeout=2)
                    except requests.exceptions.RequestException:
                        pass
                        
                elif action == "simulate_alert":
                    alert_type = command.get("type")
                    camera_id = command.get("camera_id", "cam_1")
                    alert_data = {
                        "camera_id": camera_id,
                        "event": alert_type,
                        "active": True,
                        "timestamp": int(time.time()),
                        "people": 2,
                        "stream_url": "http://192.168.54.252/stream"
                    }
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