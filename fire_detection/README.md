# 🔥 FireWatch AI — Offline Fire & Smoke Detection

Real-time fire and smoke detection using **YOLOv8** with a live web dashboard.
Runs **fully offline** after the first model download.

---

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run (webcam 0 by default)
python app.py

# 3. Open browser
open http://localhost:5000
```

---

## Stream Sources

| Source | Command |
|---|---|
| Webcam (default) | `python app.py` |
| Second webcam | `python app.py 1` |
| RTSP IP camera | `python app.py rtsp://192.168.1.100/stream` |
| RTMP stream | `python app.py rtmp://server/live/stream` |
| Local video file | `python app.py /path/to/fire_test.mp4` |
| HTTP stream | `python app.py http://server/stream.mjpg` |

---

## Dedicated Fire/Smoke Model (Recommended)

The system works out-of-the-box with the generic YOLOv8n model, but for best 
accuracy use a model specifically trained on fire and smoke:

**Option A — Best: fire_smoke.pt**
```
https://huggingface.co/foduucom/fire-and-smoke-detection-yolov8
```
Download `best.pt`, rename to `fire_smoke.pt`, place in `models/`

**Option B — Alternative:**
```
https://github.com/spacewalk01/yolov8-fire-detection
```

**Option C — Train your own:**
```bash
yolo train data=fire_dataset.yaml model=yolov8n.pt epochs=100 imgsz=640
```
Then copy `runs/detect/train/weights/best.pt` → `models/fire_smoke.pt`

---

## Project Structure

```
fire_detection/
├── app.py              # Main Flask application + inference engine
├── requirements.txt    # Python dependencies
├── setup.sh            # One-click setup script
├── models/
│   ├── yolov8n.pt      # Auto-downloaded on first run (baseline)
│   └── fire_smoke.pt   # (Optional) dedicated fire model — place here
└── templates/
    └── index.html      # Web dashboard
```

---

## Dashboard Features

- **Live MJPEG stream** with YOLO bounding boxes overlaid
- **Real-time alert badge** (flashes red on fire/smoke detection)
- **Stats counters**: fire frames, smoke frames, total frames
- **Live detections panel**: shows current frame's detected objects + confidence
- **Alert log**: timestamped history of all fire/smoke events
- **Confidence bar**: visual indicator of highest confidence in current frame

---

## Configuration

Edit these constants at the top of `app.py`:

| Variable | Default | Description |
|---|---|---|
| `conf=0.35` | 0.35 | Detection confidence threshold (lower = more sensitive) |
| `maxlen=50` | 50 | Alert log history size |
| Port | 5000 | Flask server port |

---

## Running as a Service (Linux)

```ini
# /etc/systemd/system/firewatch.service
[Unit]
Description=FireWatch AI Detection
After=network.target

[Service]
WorkingDirectory=/path/to/fire_detection
ExecStart=/usr/bin/python3 app.py 0
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable firewatch
sudo systemctl start firewatch
```
