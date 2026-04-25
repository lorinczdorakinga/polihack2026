import os
import time
import json
import cv2
import base64
import logging
import threading
import sys
from datetime import datetime
from ultralytics import YOLO

# =========================
# CONFIGURATION
# =========================
FIRE_MODEL_PATH = "yolo11n_fire_smoke.pt"
GENERAL_MODEL_PATH = "yolov8s.pt"
STREAM_URL = "http://127.0.0.1:5001/stream"
CAMERA_ID = "cam_1"
OUTPUT_JSON = "event.json"

# Thresholds
CONFIDENCE_THRESHOLD = 0.35
FALL_RATIO_THRESHOLD = 1.2
FALL_TIME_THRESHOLD = 2
INTERACTION_DISTANCE = 150

# Class Mapping for Fire Model
FIRE_CLASSES = {"Fire", "fire", "flame"}
SMOKE_CLASSES = {"Smoke", "smoke"}

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
last_alert_time = 0

class PersonState:
    def __init__(self):
        self.last_state = "standing"
        self.last_time = time.time()

person_states = {}

# =========================
# UTILS
# =========================
def encode_frame(frame):
    if frame is None: return ""
    _, buffer = cv2.imencode(".jpg", frame)
    return base64.b64encode(buffer).decode("utf-8")

def save_alert(event, people_count, frame):
    alert_data = {
        "camera_id": CAMERA_ID,
        "event": event,
        "active": event != "NORMAL",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "people": people_count,
        "image_b64": encode_frame(frame) if event != "NORMAL" else "",
        "stream_url": STREAM_URL
    }
    with open(OUTPUT_JSON, "w") as f:
        json.dump(alert_data, f, indent=4)

def get_center(box):
    return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)

def distance(b1, b2):
    c1 = get_center(b1)
    c2 = get_center(b2)
    return ((c1[0] - c2[0])**2 + (c1[1] - c2[1])**2) ** 0.5

# =========================
# CAPTURE THREAD
# =========================
def capture_thread():
    global latest_frame
    cap = cv2.VideoCapture(STREAM_URL)
    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            time.sleep(0.5)
            cap = cv2.VideoCapture(STREAM_URL)
            continue
        with frame_lock:
            latest_frame = frame

# =========================
# MAIN ENGINE
# =========================
def main():
    global person_states
    
    if len(sys.argv) > 1:
        global STREAM_URL
        STREAM_URL = sys.argv[1]

    print(f"🧠 Loading Fire Model: {FIRE_MODEL_PATH}")
    fire_model = YOLO(FIRE_MODEL_PATH)
    
    print(f"🧠 Loading General Model: {GENERAL_MODEL_PATH}")
    gen_model = YOLO(GENERAL_MODEL_PATH)

    threading.Thread(target=capture_thread, daemon=True).start()
    
    print(f"🚀 Integrated System Running on {STREAM_URL}")

    while True:
        with frame_lock:
            if latest_frame is None: continue
            frame = latest_frame.copy()

        event = "NORMAL"
        people_count = 0
        now = time.time()

        # 1. Fire/Smoke Detection
        fire_results = fire_model(frame, verbose=False, conf=CONFIDENCE_THRESHOLD)
        for r in fire_results:
            for box in r.boxes:
                label = fire_model.names[int(box.cls[0])]
                if label in FIRE_CLASSES: event = "FIRE_EVENT"
                if label in SMOKE_CLASSES and event != "FIRE_EVENT": event = "SMOKE_EVENT"

        # 2. Person Detection (Fall & Fight)
        gen_results = gen_model(frame, verbose=False, conf=CONFIDENCE_THRESHOLD)
        person_boxes = []
        for r in gen_results:
            for box in r.boxes:
                if gen_model.names[int(box.cls[0])] == "person":
                    person_boxes.append(box.xyxy[0].tolist())
        
        people_count = len(person_boxes)

        if event == "NORMAL":
            # Fall Detection Logic
            fall_detected = False
            for i, box in enumerate(person_boxes):
                pid = f"p{i}"
                if pid not in person_states: person_states[pid] = PersonState()
                
                w, h = box[2]-box[0], box[3]-box[1]
                ratio = w/h if h > 0 else 0
                
                if ratio > FALL_RATIO_THRESHOLD:
                    if now - person_states[pid].last_time > FALL_TIME_THRESHOLD:
                        fall_detected = True
                else:
                    person_states[pid].last_time = now
            
            if fall_detected:
                event = "HEALTH_EMERGENCY"

            # Fight/Interaction Detection
            if event == "NORMAL" and len(person_boxes) >= 2:
                for i in range(len(person_boxes)):
                    for j in range(i + 1, len(person_boxes)):
                        if distance(person_boxes[i], person_boxes[j]) < INTERACTION_DISTANCE:
                            # Simple wide-body check for fight stance
                            w1 = person_boxes[i][2] - person_boxes[i][0]
                            h1 = person_boxes[i][3] - person_boxes[i][1]
                            if h1 > 0 and (w1/h1) > 0.8:
                                event = "POSSIBLE_ATTACK"

        # Save & Print
        save_alert(event, people_count, frame)
        
        if event != "NORMAL":
            print(f"🚨 {event} | People: {people_count}")

        # Visualization
        annotated = frame.copy()
        cv2.putText(annotated, f"EVENT: {event}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255), 2)
        cv2.imshow("Main Emergency System", annotated)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

if __name__ == "__main__":
    main()
