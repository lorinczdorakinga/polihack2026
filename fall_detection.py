import os
import time
import logging
import cv2
import json
import base64
import threading
import numpy as np
from ultralytics import YOLO

# --- CONFIGURATION (Add these) ---
PANIC_SPEED_THRESHOLD = 400    # Pixels per second to be considered "running"
PANIC_PEOPLE_COUNT = 2         # How many people need to run to trigger a panic
# =========================
# CLEAN LOGGING & SETUP
# =========================
os.environ["YOLO_VERBOSE"] = "False"
logging.getLogger("ultralytics").setLevel(logging.ERROR)

# --- CONFIGURATION ---
MODEL_PATH = "yolov8n-pose.pt"
STREAM_URL = 0                 
CAMERA_ID = "cam_01"

# --- THRESHOLDS ---
FALL_TIME_THRESHOLD = 2.0      
PROXIMITY_THRESHOLD = 150      # Pixel distance for two people to be "engaged"
STRIKE_DISTANCE = 60           # Pixel distance for a wrist hitting a head/body
FIGHT_FRAME_LIMIT = 5          # Number of consecutive frames to confirm a fight

# =========================
# STATE TRACKING
# =========================
class PersonState:
    def __init__(self):
        self.state = "standing"
        self.start_time = time.time()
        # New attributes for velocity tracking
        self.last_pos = None
        self.last_pos_time = time.time()
        self.current_speed = 0
person_db = {}
latest_frame = None
frame_lock = threading.Lock()
last_saved_event = None

# Global counter to filter out quick, accidental overlaps (like a hug)
fight_alert_counter = 0  

model = YOLO(MODEL_PATH)

# =========================
# CAPTURE THREAD
# =========================
def capture_thread():
    global latest_frame
    cap = cv2.VideoCapture(STREAM_URL)
    
    while True:
        ret, frame = cap.read()
        if not ret:
            if isinstance(STREAM_URL, str): 
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            break
            
        with frame_lock:
            latest_frame = frame
    cap.release()

# =========================
# UTILITIES
# =========================
def encode_frame(frame):
    _, buffer = cv2.imencode(".jpg", frame)
    return base64.b64encode(buffer).decode("utf-8")

def save_event(event, value, frame):
    global last_saved_event
    if event == last_saved_event and event == "NORMAL":
        return
    
    last_saved_event = event
    data = {
        "camera_id": CAMERA_ID,
        "event": event,
        "severity": "CRITICAL" if event == "FIGHT_DETECTED" else ("HIGH" if event != "NORMAL" else "INFO"),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "count": value,
        "image": encode_frame(frame) if event != "NORMAL" else None
    }
    with open("emergency_log.json", "w") as f:
        json.dump(data, f, indent=4)

# =========================
# POSE LOGIC ENGINE
# =========================
def process_poses(results):
    global person_db, fight_alert_counter
    now = time.time()
    
    if not results[0].keypoints or results[0].boxes.id is None:
        fight_alert_counter = max(0, fight_alert_counter - 1)
        return "NORMAL", 0

    kpts_all = results[0].keypoints.xy.cpu().numpy()
    # Get tracking IDs assigned by YOLO
    track_ids = results[0].boxes.id.int().cpu().tolist() 
    
    fall_detected = 0
    theft_detected = 0
    running_people_count = 0
    current_frame_is_fight = False

    for i, kpts in enumerate(kpts_all):
        if np.sum(kpts) == 0: continue
        
        # Use YOLO's tracking ID instead of a random list index
        pid = f"person_{track_ids[i]}"
        
        if pid not in person_db:
            person_db[pid] = PersonState()
        ps = person_db[pid]

        nose = kpts[0]
        
        # --- 1. VELOCITY / PANIC DETECTION ---
        if nose[0] > 0 and nose[1] > 0: # If nose is visible
            current_pos = np.array([nose[0], nose[1]])
            
            if ps.last_pos is not None:
                time_diff = now - ps.last_pos_time
                if time_diff > 0.1: # Recalculate speed every 0.1 seconds to avoid jitter
                    distance = np.linalg.norm(current_pos - ps.last_pos)
                    ps.current_speed = distance / time_diff
                    ps.last_pos = current_pos
                    ps.last_pos_time = now
            else:
                ps.last_pos = current_pos
                ps.last_pos_time = now

            # Count how many people are running
            if ps.current_speed > PANIC_SPEED_THRESHOLD:
                running_people_count += 1

        # --- (KEEP YOUR EXISTING FALL DETECTION HERE) ---
        # --- (KEEP YOUR EXISTING THEFT DETECTION HERE) ---

    # --- (KEEP YOUR EXISTING FIGHT DETECTION HERE) ---
    # *Note: update the fight logic to use track_ids if you want specific person-to-person tracking*

    # --- DECISION TREE ---
    if running_people_count >= PANIC_PEOPLE_COUNT:
        return "PANIC_DETECTED", running_people_count
    elif theft_detected > 0:
        return "THEFT_DETECTED", theft_detected
    elif fight_alert_counter >= FIGHT_FRAME_LIMIT:
        return "FIGHT_DETECTED", fight_alert_counter
    elif fall_detected > 0:
        return "HEALTH_EMERGENCY", fall_detected
    
    return "NORMAL", 0# =========================
# MAIN EXECUTION
# =========================
def run():
    threading.Thread(target=capture_thread, daemon=True).start()
    print(f"👁️ Security System Active on {CAMERA_ID}...")

    while True:
        with frame_lock:
            if latest_frame is None: continue
            frame = latest_frame.copy()

        # Run YOLO Pose (conf=0.6 filters out ghost limbs)
        results = model.predict(frame, verbose=False, conf=0.6)
        
        event, val = process_poses(results)
        save_event(event, val, frame)

        annotated_frame = results[0].plot() 
        
        # UI Styling based on event
        if event == "FIGHT_DETECTED":
            color = (0, 0, 255) # Red for Fight
        elif event == "HEALTH_EMERGENCY":
            color = (0, 165, 255) # Orange for Fall
        else:
            color = (0, 255, 0) # Green for Normal

        cv2.rectangle(annotated_frame, (0,0), (frame.shape[1], 60), (30,30,30), -1)
        cv2.putText(annotated_frame, f"SYSTEM: {event}", (20, 40), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, color, 3)

        cv2.imshow("AI Security Monitor", annotated_frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cv2.destroyAllWindows()

if __name__ == "__main__":
    run()
