import cv2
import numpy as np
from flask import Flask, render_template, Response

app = Flask(__name__)

# Load Model
protoFile = "pose_deploy_linevec.prototxt"
weightsFile = "pose_iter_440000.caffemodel"
net = cv2.dnn.readNetFromCaffe(protoFile, weightsFile)

# OpenPose Constants
nPoints = 18
POSE_PAIRS = [[1,0],[1,2],[1,5],[2,3],[3,4],[5,6],[6,7],[1,8],[8,9],[9,10],[1,11],[11,12],[12,13],[0,14],[0,15],[14,16],[15,17]]
# Force OpenCL usage globally
cv2.ocl.setUseOpenCL(True)

def gen_frames():
    cap = cv2.VideoCapture(0)
    while True:
        success, frame = cap.read()
        if not success:
            break
        
        # --- ADD THESE TWO LINES ---
        frameHeight, frameWidth = frame.shape[:2] 
        # ---------------------------

        blob = cv2.dnn.blobFromImage(frame, 1.0 / 255, (192, 192), (127.5, 127.5, 127.5), swapRB=True, crop=False)
        net.setInput(blob)
        output = net.forward()

# ... after net.forward() ...
        output = net.forward()

        # --- ADD THIS LINE ---
        points = [] 
        # ---------------------

        for i in range(nPoints):
            probMap = output[0, i, :, :]
            _, prob, _, point = cv2.minMaxLoc(probMap)
            
            x = (frameWidth * point[0]) / output.shape[3]
            y = (frameHeight * point[1]) / output.shape[2]

            # Now 'points' is defined and can be appended to:
            points.append((int(x), int(y)) if prob > 0.1 else None)        # Draw Skeleton
        for pair in POSE_PAIRS:
            partA, partB = pair[0], pair[1]
            if points[partA] and points[partB]:
                cv2.line(frame, points[partA], points[partB], (0, 255, 255), 2)
                cv2.circle(frame, points[partA], 4, (0, 0, 255), thickness=-1)

        # Encode to JPEG
        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
