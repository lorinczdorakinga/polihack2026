import asyncio
import websockets
import json
import time
from email_notifier import process_event

async def handle_connection(websocket):
    print("✅ Frontend (React) sikeresen csatlakozott a WebSockethez!")
    
    try:
        print("⏳ Várakozás 1 másodpercet a riasztás előtt...")
        await asyncio.sleep(1)
        
        print("🔥 Riasztás (FIRE_EVENT) szimulálása...")
        
        # 1. Összeállítjuk a JSON adatot
        alert_data = {
            "camera_id": "cam_1",
            "event": "FIRE_EVENT",
            "active": True,
            "timestamp": time.time(),
            "people": 2,
            "image_b64": "" 
        }
        
        # 2. EMAIL KÜLDÉSE
        print("📧 Email küldés folyamatban...")
        try:
            process_event(alert_data)
            print("✅ Email sikeresen elküldve!")
        except Exception as e:
            print(f"❌ Hiba az email küldésekor: {e}")
            
        # 3. ADAT KÜLDÉSE A REACT-NEK
        await websocket.send(json.dumps(alert_data))
        print("📡 JSON sikeresen átküldve a Frontendnek!")
        
        # Kapcsolat nyitva tartása
        while True:
            await asyncio.sleep(1)
            
    except websockets.exceptions.ConnectionClosed:
        # Ha a React oldal frissül, vagy bezárják a böngészőt, ide lép be omlás helyett
        print("⚠️ A kliens (React) lecsatlakozott. Várakozás új kapcsolatra...")

async def main():
    print("🚀 WebSocket szerver indul: ws://localhost:5000")
    async with websockets.serve(handle_connection, "localhost", 5000):
        await asyncio.Future() 

if __name__ == "__main__":
    asyncio.run(main())