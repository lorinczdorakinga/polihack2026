#!/usr/bin/env bash
# setup.sh — One-time setup for FireWatch AI
set -e

echo "🔥 FireWatch AI — Setup"
echo "========================"

# 1. Python deps
pip install ultralytics flask opencv-python --quiet
echo "✅ Python packages installed"

# 2. Pre-download YOLOv8n (offline baseline)
python3 -c "
from ultralytics import YOLO
import shutil, os, glob

model_dir = os.path.join(os.path.dirname('$(pwd)/'), 'models')
os.makedirs(model_dir, exist_ok=True)
dst = os.path.join(model_dir, 'yolov8n.pt')
if not os.path.exists(dst):
    print('⬇  Downloading YOLOv8n …')
    m = YOLO('yolov8n.pt')
    # Find cached file
    for p in glob.glob(os.path.expanduser('~/**/*.pt'), recursive=True):
        if 'yolov8n' in p:
            shutil.copy(p, dst)
            break
    print(f'✅ Saved to {dst}')
else:
    print(f'✅ Model already cached at {dst}')
"

echo ""
echo "🔥 Fire/Smoke dedicated model (optional but recommended):"
echo "   Download from: https://huggingface.co/spaces/Yanwei-Li/Fire-Smoke-Detection"
echo "   or:            https://github.com/robmarkcole/HACS-Deepstack-Object"
echo "   Save it as:    models/fire_smoke.pt"
echo ""
echo "🚀 Run with:"
echo "   python app.py           # webcam (index 0)"
echo "   python app.py 1         # second webcam"
echo "   python app.py rtsp://IP/stream  # IP camera"
echo "   python app.py video.mp4         # test video"
echo ""
echo "🌐 Dashboard → http://localhost:5000"
