import asyncio
import websockets
import json
import time
import requests
import os

SERVO_ESP_IP = "192.168.1.100" 
WS_PORT = 8080

# --- A YOLO JSON FÁJL PONTOS ÚTVONALA ---
YOLO_JSON_PATH = "/Users/lorinczdora/Documents/sshfs/Projects/polihack2026/emergency_log.json"
async def handle_connection(websocket):
    print("✅ Frontend (React) sikeresen csatlakozott a WebSockethez!")
    
    # 1. HÁTTÉRSZÁL: A YOLO fájl folyamatos figyelése
    async def watch_yolo_file():
        last_mtime = 0
        while True:
            try:
                # Ellenőrizzük, hogy létezik-e a fájl
                if os.path.exists(YOLO_JSON_PATH):
                    # Megnézzük a fájl utolsó módosításának idejét
                    current_mtime = os.path.getmtime(YOLO_JSON_PATH)
                    
                    if current_mtime > last_mtime:
                        # Fájl módosult! Olvassuk ki.
                        with open(YOLO_JSON_PATH, 'r', encoding='utf-8') as f:
                            alert_data = json.load(f)
                        
                        # Kiküldjük a Reactnak a WebSocketen keresztül
                        await websocket.send(json.dumps(alert_data))
                        print("🚨 Új YOLO riasztás beolvasva és kiküldve a frontendnek!")
                        
                        last_mtime = current_mtime
            except Exception as e:
                # Hackathon-biztos megoldás: ha a YOLO épp írja a fájlt és összeakadunk,
                # nem fagy le a szerver, csak megpróbálja újra a következő ciklusban.
                pass
            
            # Fél másodpercenként csekkoljuk (nulla terhelés a gépnek, de azonnali reakció)
            await asyncio.sleep(0.5)

    # Elindítjuk a fájlfigyelőt
    file_watcher_task = asyncio.create_task(watch_yolo_file())

    # 2. FŐSZÁL: A React-ből érkező parancsok figyelése (Szervó & Szimuláció)
    try:
        async for message in websocket:
            try:
                command = json.loads(message)
                action = command.get("action")
                
                if action == "move_camera":
                    angle = command.get("angle")
                    print(f"🎮 Parancs érkezett: Szervó állítása {angle} fokra...")
                    try:
                        response = requests.get(f"http://{SERVO_ESP_IP}/set?angle={angle}", timeout=2)
                        print(f"✅ Szervó válasza: {response.text}")
                    except requests.exceptions.RequestException as e:
                        print(f"❌ Nem sikerült elérni a Szervó ESP-t ({SERVO_ESP_IP}): {e}")
                        
                elif action == "simulate_alert":
                    alert_type = command.get("type")
                    camera_id = command.get("camera_id", "cam_1")
                    print(f"🔥 Szimulációs kérés érkezett: {alert_type} a {camera_id} kamerán.")
                    alert_data = {
                        "camera_id": camera_id,
                        "event": alert_type,
                        "active": True,
                        "timestamp": int(time.time()),
                        "people": 2,
                        "image_b64": "", 
                        "stream_url": "http://192.168.54.252/stream"
                    }
                    await websocket.send(json.dumps(alert_data))

            except json.JSONDecodeError:
                print("❌ Érvénytelen JSON érkezett.")
                
    except websockets.exceptions.ConnectionClosed:
        print("⚠️ A kliens (React) lecsatlakozott.")
    finally:
        # Ha a frontend lecsatlakozik, leállítjuk a fájl figyelését is a memóriaszivárgás elkerülésére
        file_watcher_task.cancel() 

async def main():
    print(f"🚀 WebSocket szerver indul: ws://0.0.0.0:{WS_PORT}")
    async with websockets.serve(handle_connection, "0.0.0.0", WS_PORT):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())