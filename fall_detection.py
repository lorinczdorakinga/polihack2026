import os
import time
import logging
import cv2
import json
import base64
import threading
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
STREAM_URL = "http://192.168.54.252/stream"
CAMERA_ID = "cam_1"

FALL_RATIO_THRESHOLD = 1.2
FALL_TIME_THRESHOLD = 2

MOVEMENT_THRESHOLD = 150
ATTACK_TIME_THRESHOLD = 1.5

# =========================
# GLOBAL FRAME BUFFER
# =========================
latest_frame = None
frame_lock = threading.Lock()

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
# CAPTURE THREAD (REAL FIX)
# =========================
def capture_thread():
    global latest_frame

    cap = cv2.VideoCapture(STREAM_URL, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    while True:
        ret, frame = cap.read()

        if not ret or frame is None:
            # try to recover instead of dying
            cap.release()
            time.sleep(0.5)
            cap = cv2.VideoCapture(STREAM_URL, cv2.CAP_FFMPEG)
            continue

        with frame_lock:
            latest_frame = frame

# =========================
# ENCODE
# =========================
def encode_frame(frame):
    _, buffer = cv2.imencode(".jpg", frame)
    return base64.b64encode(buffer).decode("utf-8")

# =========================
# SAVE EVENT
# =========================
def save_event(event, value, frame):
    global last_saved_event

    if event == last_saved_event:
        return

    last_saved_event = event

    data = {
        "camera_id": CAMERA_ID,
        "event": event,
        "active": event != "NORMAL",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "people": value,
        "image": encode_frame(frame) if event != "NORMAL" else None
    }

    with open("event.json", "w") as f:
        json.dump(data, f, indent=4)

# =========================
# YOLO
# =========================
def get_people(frame):
    results = model(frame)
    boxes = []

    for r in results[0].boxes:
        cls = int(r.cls[0])
        if model.names[cls] == "person":
            boxes.append(r.xyxy[0].tolist())

    return boxes, results[0]

# =========================
# FALL
# =========================
def is_fall(box):
    x1, y1, x2, y2 = box
    w = x2 - x1
    h = y2 - y1
    if h == 0:
        return False
    return (w / h) > FALL_RATIO_THRESHOLD

# =========================
# FIRE
# =========================
def is_fire(frame):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, (5, 150, 150), (25, 255, 255))
    ratio = cv2.countNonZero(mask) / (frame.shape[0] * frame.shape[1])
    return ratio > 0.06

# =========================
# BETTER ATTACK DETECTION
# =========================

def get_center(box):
    x1, y1, x2, y2 = box
    return ((x1 + x2) / 2, (y1 + y2) / 2)


def distance(b1, b2):
    c1 = get_center(b1)
    c2 = get_center(b2)
    return ((c1[0] - c2[0])**2 + (c1[1] - c2[1])**2) ** 0.5


def is_duplicate(box1, box2):
    x1, y1, x2, y2 = box1
    X1, Y1, X2, Y2 = box2

    overlap_x = max(0, min(x2, X2) - max(x1, X1))
    overlap_y = max(0, min(y2, Y2) - max(y1, Y1))
    overlap_area = overlap_x * overlap_y

    area1 = (x2 - x1) * (y2 - y1)
    area2 = (X2 - X1) * (Y2 - Y1)

    if overlap_area > 0.7 * min(area1, area2):
        return True
    return False

# =========================
# EVENT ENGINE
# =========================
def detect_event(boxes, frame):
    global person_state, motion_state

    now = time.time()

    # =========================
    # 🧹 REMOVE DUPLICATES
    # =========================
    filtered = []
    for box in boxes:
        duplicate = False
        for f in filtered:
            if is_duplicate(box, f):
                duplicate = True
                break
        if not duplicate:
            filtered.append(box)

    boxes = filtered

    fall_count = 0
    interaction_score = 0
    wide_people = 0
    low_motion_people = 0
    same_direction_count = 0

    # =========================
    # PER PERSON ANALYSIS
    # =========================
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
        # LOW MOTION (bus stop filter)
        # =====================
        if mstate.last_box is not None:
            dx = abs(box[0] - mstate.last_box[0])
            dy = abs(box[1] - mstate.last_box[1])

            if dx + dy < 20:
                low_motion_people += 1

        # =====================
        # SAVE LAST BOX
        # =====================
        mstate.last_box = box

        # =====================
        # WIDE BODY (fight posture)
        # =====================
        if h > 0 and (w / h) > 0.8:
            wide_people += 1

    # =========================
    # INTERACTION (DISTANCE)
    # =========================
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            d = distance(boxes[i], boxes[j])

            if d < 150:
                interaction_score += 1

            # SAME DIRECTION (runner filter)
            pid1 = f"p{i}"
            pid2 = f"p{j}"

            if pid1 in motion_state and pid2 in motion_state:
                b1 = motion_state[pid1].last_box
                b2 = motion_state[pid2].last_box

                if b1 and b2:
                    dx1 = boxes[i][0] - b1[0]
                    dy1 = boxes[i][1] - b1[1]

                    dx2 = boxes[j][0] - b2[0]
                    dy2 = boxes[j][1] - b2[1]

                    if abs(dx1 - dx2) < 20 and abs(dy1 - dy2) < 20:
                        same_direction_count += 1

    # =========================
    # FIRE CHECK
    # =========================
    fire = is_fire(frame)

    # =========================
    # SMART FILTERS
    # =========================
    # runners / same direction
    if same_direction_count >= 2:
        return "NORMAL", 0

    # crowded but static
    if len(boxes) > 0 and low_motion_people >= len(boxes) * 0.7:
        return "NORMAL", 0

    # =========================
    # FINAL DECISION
    # =========================
    if fire:
        return "FIRE_EVENT", 1
    elif fall_count > 0:
        return "HEALTH_EMERGENCY", fall_count
    elif interaction_score >= 2 and wide_people >= 1:
        return "POSSIBLE_ATTACK", interaction_score
    else:
        return "NORMAL", 0

# =========================
# MAIN LOOP (PROCESS THREAD)
# =========================
def run():
    # start capture thread
    t = threading.Thread(target=capture_thread, daemon=True)
    t.start()

    print("🚀 REAL-TIME SYSTEM RUNNING (NO FREEZE MODE)")

    while True:
        with frame_lock:
            if latest_frame is None:
                continue
            frame = latest_frame.copy()

        boxes, yolo_result = get_people(frame)
        event, value = detect_event(boxes, frame)

        save_event(event, value, frame)

        annotated = yolo_result.plot()

        cv2.putText(annotated, f"People: {len(boxes)}", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        cv2.putText(annotated, f"EVENT: {event}", (20, 80),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

        if event != "NORMAL":
            print(f"🚨 {event} | value={value}")

        cv2.imshow("Smart Emergency System", annotated)

        if cv2.waitKey(1) == 27:
            break

    cv2.destroyAllWindows()

# =========================
if __name__ == "__main__":
    run()