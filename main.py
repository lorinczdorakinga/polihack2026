import os
import time
import json
import cv2
import base64
import threading
import sys
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

# Import the detectors
from fire import FireDetector
from fall_detection import FallFightDetector

# =========================
# CONFIGURATION
# =========================
STREAM_URL = "http://192.168.145.55:8080/stream"
CAMERA_ID = "cam_1"
OUTPUT_JSON = "emergency_log.json"

# =========================
# GLOBAL STATE
# =========================
latest_frame = None
frame_lock = threading.Lock()

def encode_frame(frame):
    if frame is None: return ""
    _, buffer = cv2.imencode(".jpg", frame)
    return base64.b64encode(buffer).decode("utf-8")

def save_alert(event, people_count, frame, stream_url):
    if event!="NORMAL":
        alert_data = {
            "camera_id": CAMERA_ID,
            "event": event,
            "active": event != "NORMAL",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "people": people_count,
            "stream_url": STREAM_URL
    }
        with open(OUTPUT_JSON, "w") as f:
            json.dump(alert_data, f, indent=4)

def capture_thread(url):
    global latest_frame
    cap = cv2.VideoCapture(url)
    print(f"📡 Connecting to stream: {url}")
    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            time.sleep(0.5)
            cap = cv2.VideoCapture(url)
            continue
        with frame_lock:
            latest_frame = frame

def main():
    global STREAM_URL
    if len(sys.argv) > 1:
        STREAM_URL = sys.argv[1]

    # Initialize Detectors
    print("🧠 Initializing Fire Detector...")
    fire_dev = FireDetector()
    print("🧠 Initializing Fall/Fight Detector...")
    fall_dev = FallFightDetector()

    # Start Capture
    threading.Thread(target=capture_thread, args=(STREAM_URL,), daemon=True).start()

    # Thread pool for parallel execution
    executor = ThreadPoolExecutor(max_workers=2)

    print(f"🚀 Integrated System Running on {STREAM_URL}")

    while True:
        with frame_lock:
            if latest_frame is None: continue
            frame = latest_frame.copy()

        # Execute detectors in parallel
        # Note: We pass the same frame copy to both
        future_fire = executor.submit(fire_dev.detect, frame)
        future_fall = executor.submit(fall_dev.detect, frame)

        fire_event, fire_dets = future_fire.result()
        fall_event, people_count, pose_results  = future_fall.result()

        # Priority logic: Fire > Panic > Fight > Fall > Normal
        final_event = "NORMAL"
        if fire_event != "NORMAL":
            final_event = fire_event
        elif fall_event != "NORMAL":
            final_event = fall_event

        # Write to JSON
        save_alert(final_event, people_count, frame, STREAM_URL)

        # Rendering Preview
        # 1. Use the pose results to plot skeletons
        preview_frame = pose_results.plot()

        # 2. Draw Fire/Smoke detections manually
        for d in fire_dets:
            x1, y1, x2, y2 = d["bbox"]
            color = (0, 0, 255) if d["kind"] == "fire" else (128, 128, 128)
            cv2.rectangle(preview_frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(preview_frame, f"{d['label']} {d['conf']}", (x1, y1-10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        if final_event != "NORMAL":
            print(f"🚨 {final_event} | People: {people_count}")

        # Final UI Overlay
        cv2.putText(preview_frame, f"EVENT: {final_event}", (20, 40), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        cv2.imshow("Multi-AI Coordinator", preview_frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

if __name__ == "__main__":
    main()
