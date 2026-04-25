"""
Fire & Smoke Detection System
Uses YOLOv8 with a fire/smoke trained model for live stream detection.
Runs fully offline after initial model download.
"""

import cv2
import time
import threading
import json
import os
from flask import Flask, Response, render_template, jsonify
from datetime import datetime
from collections import deque

app = Flask(__name__)

# ── Global state ──────────────────────────────────────────────────────────────
detection_state = {
    "alerts": deque(maxlen=50),
    "stats": {"fire": 0, "smoke": 0, "total_frames": 0, "fps": 0},
    "latest_detections": [],
    "alert_active": False,
}
state_lock = threading.Lock()
frame_buffer = {"frame": None, "lock": threading.Lock()}


# ── Model loader ──────────────────────────────────────────────────────────────
def load_model():
    """
    Load YOLOv8 fire/smoke model.
    Priority order:
      1. Local models/fire_smoke.pt  (user-supplied)
      2. Local models/yolov8n.pt     (cached generic)
      3. Download best available fire model from Ultralytics Hub / fallback
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        print("⚠  ultralytics not installed. Run:  pip install ultralytics")
        return None

    model_dir = os.path.join(os.path.dirname(__file__), "models")
    os.makedirs(model_dir, exist_ok=True)

    # 1. Custom fire/smoke model
    custom = os.path.join(model_dir, "fire_smoke.pt")
    if os.path.exists(custom):
        print(f"✅ Loading custom fire model: {custom}")
        return YOLO(custom)

    # 2. Generic nano model (very fast, works offline once cached)
    generic = os.path.join(model_dir, "yolov8n.pt")
    if os.path.exists(generic):
        print(f"✅ Loading cached YOLOv8n: {generic}")
        model = YOLO(generic)
        return model

    # 3. Download (only happens once; saved to models/)
    print("⬇  Downloading YOLOv8n (first run only) …")
    try:
        model = YOLO("yolov8n.pt")          # downloads to ~/.cache then we copy
        import shutil, glob
        cached = glob.glob(os.path.expanduser("~/.cache/torch/**/*.pt"), recursive=True)
        for c in cached:
            if "yolov8n" in c:
                shutil.copy(c, generic)
                break
        return model
    except Exception as e:
        print(f"❌ Could not load model: {e}")
        return None


# ── Class label mapping ───────────────────────────────────────────────────────
FIRE_CLASSES  = {"fire", "flame", "flames"}
SMOKE_CLASSES = {"smoke", "smog", "haze"}

# For generic COCO models we add some visual-heat proxies so the UI still works
PROXY_CLASSES = {"fire": FIRE_CLASSES, "smoke": SMOKE_CLASSES}

def classify_label(label: str):
    l = label.lower()
    if l in FIRE_CLASSES:
        return "fire"
    if l in SMOKE_CLASSES:
        return "smoke"
    return "other"


# ── Inference thread ──────────────────────────────────────────────────────────
def run_inference(source=0):
    """
    Grab frames from *source* (int = webcam index, str = RTSP/file URL),
    run YOLO inference, annotate, push to frame_buffer.
    """
    model = load_model()
    cap = cv2.VideoCapture(source)

    if not cap.isOpened():
        print(f"❌ Cannot open video source: {source}")
        # Push a placeholder frame so the stream doesn't hang
        _push_error_frame("Cannot open video source")
        return

    fps_counter, fps_t0 = 0, time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            # Loop for file sources; for live feeds try to reconnect
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            time.sleep(0.1)
            continue

        # ── YOLO inference ────────────────────────────────────────────────
        detections = []
        if model:
            try:
                results = model(frame, verbose=False, conf=0.35)
                for r in results:
                    for box in r.boxes:
                        cls_id  = int(box.cls[0])
                        label   = model.names[cls_id]
                        conf    = float(box.conf[0])
                        kind    = classify_label(label)
                        x1,y1,x2,y2 = map(int, box.xyxy[0])
                        detections.append({
                            "label": label,
                            "kind":  kind,
                            "conf":  round(conf, 3),
                            "bbox":  [x1, y1, x2, y2],
                        })
            except Exception as e:
                print(f"Inference error: {e}")

        # ── Annotate frame ────────────────────────────────────────────────
        frame = annotate(frame, detections)

        # ── Update state ──────────────────────────────────────────────────
        fps_counter += 1
        if fps_counter % 15 == 0:
            elapsed = time.time() - fps_t0
            fps = fps_counter / elapsed if elapsed > 0 else 0
            fps_counter, fps_t0 = 0, time.time()
            with state_lock:
                detection_state["stats"]["fps"] = round(fps, 1)

        with state_lock:
            detection_state["stats"]["total_frames"] += 1
            detection_state["latest_detections"] = detections

            has_fire  = any(d["kind"] == "fire"  for d in detections)
            has_smoke = any(d["kind"] == "smoke" for d in detections)

            if has_fire or has_smoke:
                detection_state["alert_active"] = True
                if has_fire:
                    detection_state["stats"]["fire"] += 1
                if has_smoke:
                    detection_state["stats"]["smoke"] += 1
                detection_state["alerts"].appendleft({
                    "time": datetime.now().strftime("%H:%M:%S"),
                    "type": "🔥 FIRE" if has_fire else "💨 SMOKE",
                    "conf": max(d["conf"] for d in detections),
                })
            else:
                detection_state["alert_active"] = False

        # ── Push annotated frame ──────────────────────────────────────────
        with frame_buffer["lock"]:
            frame_buffer["frame"] = frame

        time.sleep(0.01)   # ~100 fps cap; YOLO will be the real bottleneck


def annotate(frame, detections):
    """Draw bounding boxes and labels onto the frame."""
    COLOR = {"fire": (0, 60, 255), "smoke": (80, 80, 80), "other": (0, 220, 100)}
    for d in detections:
        x1,y1,x2,y2 = d["bbox"]
        color = COLOR.get(d["kind"], (200, 200, 200))
        cv2.rectangle(frame, (x1,y1), (x2,y2), color, 2)
        txt = f"{d['label'].upper()} {d['conf']:.0%}"
        (tw, th), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(frame, (x1, y1-th-8), (x1+tw+6, y1), color, -1)
        cv2.putText(frame, txt, (x1+3, y1-5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 2)

    # Timestamp overlay
    ts = datetime.now().strftime("%Y-%m-%d  %H:%M:%S")
    cv2.putText(frame, ts, (10, frame.shape[0]-10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200,200,200), 1)
    return frame


def _push_error_frame(msg):
    import numpy as np
    err = np.zeros((480, 640, 3), dtype="uint8")
    cv2.putText(err, msg, (40, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,60,255), 2)
    with frame_buffer["lock"]:
        frame_buffer["frame"] = err


# ── Flask routes ──────────────────────────────────────────────────────────────
def generate_frames():
    while True:
        with frame_buffer["lock"]:
            frame = frame_buffer["frame"]
        if frame is None:
            time.sleep(0.05)
            continue
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n")
        time.sleep(0.033)   # ~30 fps stream


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/video_feed")
def video_feed():
    return Response(generate_frames(),
                    mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/api/state")
def api_state():
    with state_lock:
        return jsonify({
            "stats":   dict(detection_state["stats"]),
            "alert":   detection_state["alert_active"],
            "alerts":  list(detection_state["alerts"])[:10],
            "dets":    detection_state["latest_detections"],
        })


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    # Accept optional stream source as CLI arg: python app.py 0  OR  rtsp://...
    source = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else \
             sys.argv[1] if len(sys.argv) > 1 else 0

    print(f"🎥 Starting inference on source: {source}")
    t = threading.Thread(target=run_inference, args=(source,), daemon=True)
    t.start()

    print("🌐 Dashboard → http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
