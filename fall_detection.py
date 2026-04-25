import os
import time
import logging
import cv2
import json
import base64
import threading
from queue import Queue
from ultralytics import YOLO
# =========================
# CLEAN LOGGING
# =========================
os.environ["YOLO_VERBOSE"] = "False"
logging.getLogger("ultralytics").setLevel(logging.ERROR)
# =========================
# CONFIG
# =========================
MODEL_PATH = "yolov8n.pt"
RTSP_URL = "rtsp://192.168.192.133:8554/cam"
CAMERA_ID = "cam_1"

FALL_RATIO_THRESHOLD = 1.2
FALL_TIME_THRESHOLD = 2

MOVEMENT_THRESHOLD = 150
ATTACK_TIME_THRESHOLD = 1.5

OUTPUT_DIR = "events"

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

# =========================
# STATES
# =========================
class PersonState:
    def __init__(self):
        self.last_state = "standing"
        self.last_time = time.time()

class MotionState:
    def __init__(self):
        self.last_box = None
        self.attack_start = None

person_state = {}
motion_state = {}

last_saved_event = None

model = YOLO(MODEL_PATH, verbose=False)

# =========================
# SAVE IMAGE (VISIBLE)
# =========================

def save_frame_image(frame):
    timestamp = time.strftime("%Y%m%d_%H%M%S", time.localtime())
    filename = f"{OUTPUT_DIR}/event_{timestamp}.jpg"

    cv2.imwrite(filename, frame)

    return filename

# =========================
# ENCODE
# =========================
def encode_frame(frame):
    _, buffer = cv2.imencode(".jpg", frame)
    jpg_as_text = base64.b64encode(buffer).decode("utf-8")
    return jpg_as_text
# =========================
# SAVE JSON
# =========================
def save_event(event, value, frame):
    global last_saved_event

    if event == last_saved_event:
        return

    last_saved_event = event

    image_b64 = None

    if event != "NORMAL":
        image_b64 = encode_frame(frame)

    data = {
        "camera_id": CAMERA_ID,
        "event": event,
        "active": event != "NORMAL",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime()),
        "people": value,
        "image": image_b64
    }

    with open("event.json", "w") as f:
        json.dump(data, f, indent=4)

# =========================
# GET PEOPLE BOXES
# =========================
def get_people(frame):
    results = model(frame)
    boxes = []

    for r in results[0].boxes:
        cls = int(r.cls[0])
        if model.names[cls] != "person":
            continue
        boxes.append(r.xyxy[0].tolist())

    return boxes

# =========================
# FALL CHECK
# =========================
def is_fall(box):
    x1, y1, x2, y2 = box
    w = x2 - x1
    h = y2 - y1
    if h == 0:
        return False
    return (w / h) > FALL_RATIO_THRESHOLD

# =========================
# FIRE CHECK
# =========================
def is_fire(frame):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    lower = (5, 150, 150)
    upper = (25, 255, 255)

    mask = cv2.inRange(hsv, lower, upper)
    ratio = cv2.countNonZero(mask) / (frame.shape[0] * frame.shape[1])

    return ratio > 0.06

# =========================
# EVENT ENGINE
# =========================
def detect_event(boxes, frame):
    global person_state, motion_state

    now = time.time()
    fall_count = 0
    attack_count = 0

    for i, box in enumerate(boxes):
        pid = f"p{i}"

        if pid not in person_state:
            person_state[pid] = PersonState()

        if pid not in motion_state:
            motion_state[pid] = MotionState()

        pstate = person_state[pid]
        mstate = motion_state[pid]

        x1, y1, x2, y2 = box
        w = x2 - x1
        h = y2 - y1
        ratio = w / h if h != 0 else 0

        # =====================
        # FALL DETECTION
        # =====================
        if ratio > FALL_RATIO_THRESHOLD:
            if pstate.last_state == "falling":
                if now - pstate.last_time > FALL_TIME_THRESHOLD:
                    fall_count += 1
            else:
                pstate.last_state = "falling"
                pstate.last_time = now
        else:
            pstate.last_state = "standing"
            pstate.last_time = now

        # =====================
        # ATTACK DETECTION
        # =====================
        if mstate.last_box is not None:
            dx = abs(box[0] - mstate.last_box[0])
            dy = abs(box[1] - mstate.last_box[1])

            movement = dx + dy

            if movement > MOVEMENT_THRESHOLD:
                if mstate.attack_start is None:
                    mstate.attack_start = now
                elif now - mstate.attack_start > ATTACK_TIME_THRESHOLD:
                    attack_count += 1
            else:
                mstate.attack_start = None
        else:
            mstate.attack_start = None

        mstate.last_box = box

    # =====================
    # FIRE CHECK
    # =====================
    fire = is_fire(frame)

    # crowd suppression
    if len(boxes) > 4:
        attack_count = 0

    # =====================
    # FINAL DECISION
    # =====================
    if fire:
        return "FIRE_EVENT", 1
    elif fall_count > 0:
        return "HEALTH_EMERGENCY", fall_count
    elif attack_count >= 3:
        return "POSSIBLE_ATTACK", attack_count
    else:
        return "NORMAL", 0

# =========================
# THREAD-SAFE STREAM READER
# =========================
class VideoStream:
    def __init__(self, src):
        self.cap = cv2.VideoCapture(src)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.ret, self.frame = False, None
        self.stopped = False
        self.lock = threading.Lock()

    def start(self):
        t = threading.Thread(target=self.update, args=())
        t.daemon = True
        t.start()
        return self

    def update(self):
        while not self.stopped:
            ret, frame = self.cap.read()
            with self.lock:
                self.ret = ret
                self.frame = frame
            if not ret:
                self.stop()

    def read(self):
        with self.lock:
            return self.ret, self.frame

    def stop(self):
        self.stopped = True
        self.cap.release()

# =========================
# MODIFIED RUN LOOP
# =========================
def run():
    # Use the threaded stream reader
    stream = VideoStream("http://192.168.54.252/stream").start()
    
    # Wait a moment for the stream to initialize
    time.sleep(1.0)
    
    print("✅ Multithreaded Emergency System Running...")

    while not stream.stopped:
        ret, frame = stream.read()

        if not ret or frame is None:
            continue

        # 1. AI Inference (This is the bottleneck, now isolated from capture)
        boxes = get_people(frame)
        event, value = detect_event(boxes, frame)

        # 2. Disk I/O (Can be further threaded if JSON saving is slow)
        save_event(event, value, frame)

        # 3. Visualization
        annotated = model(frame)[0].plot()

        cv2.putText(annotated, f"People: {len(boxes)}", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.putText(annotated, f"EVENT: {event}", (20, 80),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

        if event != "NORMAL":
            print(f"🚨 {event} | value={value}")
        
        cv2.imshow("Smart Emergency System", annotated)

        if cv2.waitKey(1) == 27:
            stream.stop()
            break

    cv2.destroyAllWindows()

if __name__ == "__main__":
    run()
