import cv2
from flask import Flask, Response

app = Flask(__name__)

def generate_frames():
    # 0 is usually the built-in MacBook webcam
    camera = cv2.VideoCapture(0)
    
    while True:
        success, frame = camera.read()
        if not success:
            break
        else:
            # Lower resolution for better streaming performance
            frame = cv2.resize(frame, (640, 480))
            ret, buffer = cv2.imencode('.jpg', frame)
            frame = buffer.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/stream')
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == "__main__":
    print("🚀 Webcam Streamer started at http://localhost:5001/stream")
    print("Press CTRL+C to stop")
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)
