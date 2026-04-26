import os
import cv2
from ultralytics import YOLO

class FireDetector:
    def __init__(self, model_path="yolo11n_fire_smoke.pt", conf=0.35):
        self.model = YOLO(model_path)
        self.conf = conf
        self.fire_classes = {"Fire", "fire", "flame"}
        self.smoke_classes = {"Smoke", "smoke"}

    def detect(self, frame):
        results = self.model(frame, verbose=False, conf=self.conf)
        detections = []
        event = "NORMAL"
        
        for r in results:
            for box in r.boxes:
                label = self.model.names[int(box.cls[0])]
                conf = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                
                kind = "other"
                if label in self.fire_classes:
                    kind = "fire"
                    event = "FIRE_EVENT"
                elif label in self.smoke_classes:
                    kind = "smoke"
                    if event != "FIRE_EVENT":
                        event = "SMOKE_EVENT"
                
                detections.append({
                    "label": label,
                    "kind": kind,
                    "conf": round(conf, 3),
                    "bbox": [x1, y1, x2, y2]
                })
        
        return event, detections
