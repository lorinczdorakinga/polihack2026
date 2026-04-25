import os
import time
import json
import cv2
import base64
import logging
import threading
from datetime import datetime
from ultralytics import YOLO

# =========================
# CONFIGURATION / SETUP
# =========================
MODEL_PATH = "yolo11n_fire_smoke.pt"           # Your custom model
FALLBACK_MODELS = ["yolo.pt", "yolov8s.pt", "yolov8n.pt"] 
STREAM_URL = "http://192.168.54.252/stream"
CAMERA_ID = "cam_1"
OUTPUT_JSON = "event.json"

# Detection sensitivity
CONFIDENCE_THRESHOLD = 0.35      
# Class names often used in fire models (maps to our kinds)
FIRE_CLASSES  = {"fire", "flame", "flames", "fire_detected"}
SMOKE_CLASSES = {"smoke", "smog", "haze"}

# =========================
# CLEAN LOGGING
# =========================
os.environ["YOLO_VERBOSE"] = "False"
logging.getLogger("ultralytics").setLevel(logging.ERROR)

# =========================
# GLOBAL STATE
# =========================
latest_frame = None
frame_lock = threading.Lock()
last_saved_event = None

# =========================
# UTILITIES
# =========================
def encode_frame(frame):
    """Base64 encode frame for JSON output."""
    _, buffer = cv2.imencode(".jpg", frame)
    return base64.b64encode(buffer).decode("utf-8")

def classify_label(label: str):
    """Map model label to internal 'fire' or 'smoke' kind."""
    l = label.lower()
    if l in FIRE_CLASSES: return "fire"
    if l in SMOKE_CLASSES: return "smoke"
    return "other"

def save_event(event_type, detections, frame):
    """Write detection state to JSON file."""
    global last_saved_event

    # Only save if state changed or we have an active event
    if event_type == last_saved_event and event_type == "NORMAL":
        return

    last_saved_event = event_type

    data = {
        "camera_id": CAMERA_ID,
        "event": event_type,
        "active": event_type != "NORMAL",
        "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "detections": detections,
        "image": encode_frame(frame) if event_type != "NORMAL" else None
    }

    try:
        with open(OUTPUT_JSON, "w") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"Error saving {OUTPUT_JSON}: {e}")

# =========================
# CAPTURE THREAD
# =========================
def capture_thread():
    global latest_frame
    print(f"📡 Connecting to: {STREAM_URL}")
    
    cap = cv2.VideoCapture(STREAM_URL)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            time.sleep(1)
            cap.release()
            cap = cv2.VideoCapture(STREAM_URL)
            continue

        with frame_lock:
            latest_frame = frame

# =========================
# MAIN PROCESSING
# =========================
def run():
    # 1. Load Model
    model_to_use = None
    if os.path.exists(MODEL_PATH):
        model_to_use = MODEL_PATH
    else:
        for fallback in FALLBACK_MODELS:
            if os.path.exists(fallback):
                model_to_use = fallback
                break
    
    if not model_to_use:
        print("❌ No model files found! Looking for yolo.pt, yolov8s.pt, or yolov8n.pt")
        return

    print(f"🧠 Loading model: {model_to_use}")
    try:
        model = YOLO(model_to_use)
        print(f"✅ Model loaded. Classes: {list(model.names.values())[:10]}...")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return

    # 2. Start Capture
    t = threading.Thread(target=capture_thread, daemon=True)
    t.start()

    print("🚀 Fire Detection System Started")
    print("CTRL+C to stop")

    try:
        while True:
            with frame_lock:
                if latest_frame is None:
                    continue
                frame = latest_frame.copy()

            # 3. YOLO Inference
            results = model(frame, verbose=False, conf=CONFIDENCE_THRESHOLD)
            detections = []
            
            for r in results:
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    label = model.names[cls_id]
                    conf = float(box.conf[0])
                    kind = classify_label(label)
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    
                    detections.append({
                        "label": label,
                        "kind": kind,
                        "conf": round(conf, 3),
                        "bbox": [x1, y1, x2, y2]
                    })

            # 4. Event Logic
            has_fire = any(d["kind"] == "fire" for d in detections)
            has_smoke = any(d["kind"] == "smoke" for d in detections)

            if detections:
                print(f"DEBUG: Detected {len(detections)} objects: {[d['label'] for d in detections]}")

            event = "NORMAL"
            if has_fire: event = "FIRE_EVENT"
            elif has_smoke: event = "SMOKE_EVENT"

            if event != "NORMAL":
                print(f"🚨 {event} detected!")

            # 5. Output
            save_event(event, detections, frame)

            # 6. Visualization
            annotated = frame.copy()
            for d in detections:
                x1, y1, x2, y2 = d["bbox"]
                color = (0, 0, 255) if d["kind"] == "fire" else (128, 128, 128)
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                cv2.putText(annotated, f"{d['label']} {d['conf']}", (x1, y1-10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            
            cv2.imshow("Fire Detection", annotated)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        cv2.destroyAllWindows()

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        STREAM_URL = sys.argv[1]
    run()
