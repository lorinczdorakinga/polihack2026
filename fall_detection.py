import os
import time
import logging
import cv2
from ultralytics import YOLO

# =========================
# 🔇 SILENCE YOLO SPAM
# =========================
os.environ["YOLO_VERBOSE"] = "False"
logging.getLogger("ultralytics").setLevel(logging.ERROR)

# =========================
# 🔧 CONFIG
# =========================
MODEL_PATH = "yolov8n.pt"
RTSP_URL = "rtsp://192.168.192.133:8554/cam"

FALL_RATIO_THRESHOLD = 1.2
FALL_PERSISTENCE_TIME = 10  # seconds

# =========================
# 🧠 STATE
# =========================
class PersonState:
    def __init__(self):
        self.last_state = "unknown"
        self.last_change_time = time.time()
        self.fallen = False

state_memory = {}

model = YOLO(MODEL_PATH, verbose=False)


# =========================
# 👁️ GET PERSON BOXES
# =========================
def get_person_boxes(frame):
    results = model(frame)
    boxes = []

    for r in results[0].boxes:
        cls_id = int(r.cls[0])
        label = model.names[cls_id]

        if label != "person":
            continue

        boxes.append(r.xyxy[0].tolist())

    return boxes


# =========================
# 📐 FALL HEURISTIC
# =========================
def is_fall(box):
    x1, y1, x2, y2 = box

    width = x2 - x1
    height = y2 - y1

    if height == 0:
        return False

    ratio = width / height

    return ratio > FALL_RATIO_THRESHOLD


# =========================
# 🧠 FALL LOGIC ENGINE
# =========================
def detect_falls(boxes):
    global state_memory

    now = time.time()
    fall_count = 0

    for i, box in enumerate(boxes):
        key = f"p{i}"

        if key not in state_memory:
            state_memory[key] = PersonState()

        person = state_memory[key]

        if is_fall(box):
            if person.last_state == "falling":
                if now - person.last_change_time > FALL_PERSISTENCE_TIME:
                    person.fallen = True
            else:
                person.last_state = "falling"
                person.last_change_time = now
        else:
            person.last_state = "standing"
            person.fallen = False
            person.last_change_time = now

        if person.fallen:
            fall_count += 1

    return fall_count


# =========================
# 🎥 MAIN LOOP
# =========================
def run():
    cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if not cap.isOpened():
        print("❌ Cannot open RTSP stream")
        return

    print("✅ Smart Fall Detection Running...")

    while True:
        ret, frame = cap.read()

        if not ret or frame is None:
            print("⚠️ Frame not received")
            continue

        # YOLO detection
        boxes = get_person_boxes(frame)

        # fall detection
        falls = detect_falls(boxes)

        # visualization
        annotated = model(frame)[0].plot()

        cv2.putText(
            annotated,
            f"People: {len(boxes)}",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            2
        )

        cv2.putText(
            annotated,
            f"Falls: {falls}",
            (20, 80),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 0, 255),
            3
        )

        # =========================
        # 🧾 CLEAN TERMINAL OUTPUT
        # =========================
        if falls > 0:
            print(f"🚨 FALL DETECTED | count={falls}")
        else:
            print(f"OK | people={len(boxes)}")

        cv2.imshow("Smart Fall System", annotated)

        if cv2.waitKey(1) == 27:
            break

    cap.release()
    cv2.destroyAllWindows()


# =========================
# 🚀 RUN
# =========================
if __name__ == "__main__":
    run()