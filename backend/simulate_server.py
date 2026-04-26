import asyncio
import websockets
import json
import time
import requests
import os
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ── Rendszer Konfiguráció ────────────────────────────────────────────────────
SERVO_ESP_IP = "192.168.1.100" 
WS_PORT = 8080
YOLO_JSON_PATH = "/Users/lorinczdora/Documents/sshfs/Projects/polihack2026/emergency_log.json"

# ── Email Konfiguráció ───────────────────────────────────────────────────────
SENDER_EMAIL = "polihackbyteme@gmail.com"   
SENDER_PASSWORD = "heutdkjqstmqlozh"   

EVENT_RECIPIENTS = {
    "FIRE_EVENT":         "rcsavasi@gmail.com",
    "HEALTH_EMERGENCY":   "ritacsavasi2@gmail.com",
    "POSSIBLE_ATTACK":    "csavasirita22@gmail.com",
}

EVENT_SUBJECTS = {
    "FIRE_EVENT":         "🔥 Fire Alert Detected!",
    "HEALTH_EMERGENCY":   "🚑 Health Emergency Detected!",
    "POSSIBLE_ATTACK":    "⚠️ Possible Attack Detected!",
}

# --- Szinkron Email Küldő Függvény ---
def send_email_sync(event, camera, timestamp_str, people):
    if event not in EVENT_RECIPIENTS:
        return

    recipient = EVENT_RECIPIENTS[event]
    subject = EVENT_SUBJECTS[event]
    body = (
        f"🚨 AUTOMATED DISPATCH ALERT 🚨\n\n"
        f"Alert from camera: {camera}\n"
        f"Event type: {event}\n"
        f"Time of detection: {timestamp_str}\n"
        f"People detected: {people}\n\n"
        f"Please check the Dispatcher Center immediately."
    )

    try:
        msg = MIMEMultipart()
        msg["From"] = SENDER_EMAIL
        msg["To"] = recipient
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, recipient, msg.as_string())

        print(f"📧 [EMAIL SIKERES] Értesítés elküldve ide: {recipient} ({event})")
    except Exception as e:
        print(f"❌ [EMAIL HIBA] Nem sikerült elküldeni az emailt: {e}")


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
                            "stream_url": "http://192.168.54.252/stream" 
                        }
                        
                        # 1. Szólunk a Reactnek, hogy mutassa a térképen
                        await websocket.send(json.dumps(alert_data))
                        print(f"🚨 Új Esemény! Idő: {formatted_time} - {event_type}")
                        
                        # 2. Elküldjük az emailt a háttérben (hogy ne akassza meg a rendszert)
                        asyncio.create_task(asyncio.to_thread(send_email_sync, event_type, camera_id, formatted_time, people_cnt))
                        
                        last_mtime = current_mtime
            except Exception as e:
                pass
            
            await asyncio.sleep(0.1)

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
                    
                    unix_ts = int(time.time())
                    formatted_time = datetime.fromtimestamp(unix_ts).strftime('%H:%M:%S')

                    alert_data = {
                        "camera_id": camera_id,
                        "event": alert_type,
                        "active": True,
                        "timestamp": unix_ts,
                        "time_string": formatted_time,
                        "people": 2,
                        "stream_url": "http://192.168.54.252/stream"
                    }
                    
                    # 1. Szimuláció kiküldése a Reactnek
                    await websocket.send(json.dumps(alert_data))
                    
                    # 2. Szimulációnál is küldünk emailt a demó kedvéért!
                    asyncio.create_task(asyncio.to_thread(send_email_sync, alert_type, camera_id, formatted_time, 2))

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