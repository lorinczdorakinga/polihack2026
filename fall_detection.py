import os
import time
import cv2
import numpy as np
from ultralytics import YOLO

class FallFightDetector:
    def __init__(self, model_path="yolov8n-pose.pt", conf=0.6):
        self.model = YOLO(model_path)
        self.conf = conf
        self.person_db = {}
        self.fight_alert_counter = 0
        
        # Thresholds
        self.FALL_RATIO_THRESHOLD = 1.2
        self.FALL_TIME_THRESHOLD = 2.0
        self.PROXIMITY_THRESHOLD = 150
        self.STRIKE_DISTANCE = 60
        self.FIGHT_FRAME_LIMIT = 3
        self.PANIC_SPEED_THRESHOLD = 150
        self.PANIC_PEOPLE_COUNT = 2

    class PersonState:
        def __init__(self):
            self.last_pos = None
            self.last_pos_time = time.time()
            self.current_speed = 0
            self.fall_start_time = None

    def detect(self, frame):
        results = self.model.predict(frame, verbose=False, conf=self.conf)
        now = time.time()
        
        if not results[0].keypoints:
            self.fight_alert_counter = max(0, self.fight_alert_counter - 1)
            return "NORMAL", 0, results[0]

        kpts_all = results[0].keypoints.xy.cpu().numpy()
        track_ids = None
        if results[0].boxes is not None and results[0].boxes.id is not None:
            track_ids = results[0].boxes.id.int().cpu().tolist()

        fall_detected = False
        running_people_count = 0
        current_frame_is_fight = False
        people_count = len(kpts_all)

        for i, kpts in enumerate(kpts_all):
            if np.sum(kpts) == 0: continue
            
            # Panic Detection
            if track_ids and i < len(track_ids):
                pid = f"person_{track_ids[i]}"
                if pid not in self.person_db: self.person_db[pid] = self.PersonState()
                ps = self.person_db[pid]
                nose = kpts[0]
                if nose[0] > 0:
                    curr_pos = np.array([nose[0], nose[1]])
                    time_diff = now - ps.last_pos_time
                    if time_diff > 0.1:
                        dist = np.linalg.norm(curr_pos - ps.last_pos)
                        ps.current_speed = dist / time_diff
                        ps.last_pos = curr_pos
                        ps.last_pos_time = now
                        if ps.current_speed > self.PANIC_SPEED_THRESHOLD:
                            running_people_count += 1

            # Fall Detection
            nose = kpts[0]
            avg_hip_y = (kpts[11][1] + kpts[12][1]) / 2
            w = np.abs(kpts[11][0] - kpts[12][0]) # simplified width
            h = np.abs(nose[1] - avg_hip_y)
            if h > 0 and (w/h) > self.FALL_RATIO_THRESHOLD:
                fall_detected = True

        # Fight Detection
        for i in range(len(kpts_all)):
            for j in range(i + 1, len(kpts_all)):
                dist = np.linalg.norm((kpts_all[i][5]+kpts_all[i][6])/2 - (kpts_all[j][5]+kpts_all[j][6])/2)
                if dist < self.PROXIMITY_THRESHOLD:
                    # Check wrists vs heads
                    for wrist in [kpts_all[i][9], kpts_all[i][10]]:
                        if wrist[0] > 0 and np.linalg.norm(wrist - kpts_all[j][0]) < self.STRIKE_DISTANCE:
                            current_frame_is_fight = True
                    for wrist in [kpts_all[j][9], kpts_all[j][10]]:
                        if wrist[0] > 0 and np.linalg.norm(wrist - kpts_all[i][0]) < self.STRIKE_DISTANCE:
                            current_frame_is_fight = True

        if current_frame_is_fight: self.fight_alert_counter += 1
        else: self.fight_alert_counter = max(0, self.fight_alert_counter - 1)

        # Decision
        final_event = "NORMAL"
        if running_people_count >= self.PANIC_PEOPLE_COUNT: final_event = "PANIC_DETECTED"
        elif self.fight_alert_counter >= self.FIGHT_FRAME_LIMIT: final_event = "POSSIBLE_ATTACK"
        elif fall_detected: final_event = "HEALTH_EMERGENCY"
        
        return final_event, people_count, results[0]
