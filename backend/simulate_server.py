import asyncio
import websockets
import json
import time
import requests

SERVO_ESP_IP = "192.168.1.100" # Az ESP8266 IP címe!
WS_PORT = 8080

async def handle_connection(websocket):
    print("✅ Frontend (React) sikeresen csatlakozott a WebSockethez!")
    
    try:
        async for message in websocket:
            try:
                command = json.loads(message)
                action = command.get("action")
                
                # 1. ES ESET: Kamera mozgatása (React -> ESP)
                if action == "move_camera":
                    angle = command.get("angle")
                    print(f"🎮 Parancs érkezett: Szervó állítása {angle} fokra...")
                    try:
                        response = requests.get(f"http://{SERVO_ESP_IP}/set?angle={angle}", timeout=2)
                        print(f"✅ Szervó válasza: {response.text}")
                    except requests.exceptions.RequestException as e:
                        print(f"❌ Nem sikerült elérni a Szervó ESP-t ({SERVO_ESP_IP}): {e}")
                        
                # 2. ES ESET: Szimulált riasztás gombnyomásra (React -> Python -> React)
                elif action == "simulate_alert":
                    alert_type = command.get("type")
                    camera_id = command.get("camera_id", "cam_1")
                    print(f"🔥 Szimulációs kérés érkezett: {alert_type} a {camera_id} kamerán.")
                    
                    # Összeállítjuk azt a JSON-t, amit később az igazi AI fog küldeni
                    alert_data = {
                        "camera_id": camera_id,
                        "event": alert_type,
                        "active": True,
                        "timestamp": int(time.time()),
                        "people": 2,
                        "image_b64": "", 
                        "stream_url": "http://192.168.54.252/stream" # Az ESP32-S3 kamerád IP-je
                    }
                    
                    # Visszaküldjük a frontendnek
                    await websocket.send(json.dumps(alert_data))
                    print("📤 AI Riasztás JSON kiküldve a kliensnek!")

            except json.JSONDecodeError:
                print("❌ Érvénytelen JSON érkezett.")
                
    except websockets.exceptions.ConnectionClosed:
        print("⚠️ A kliens (React) lecsatlakozott. Várakozás új kapcsolatra...")

async def main():
    print(f"🚀 WebSocket szerver indul: ws://0.0.0.0:{WS_PORT}")
    print(f"🤖 Szervó ESP megcélzott IP-je: {SERVO_ESP_IP}")
    async with websockets.serve(handle_connection, "0.0.0.0", WS_PORT):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())