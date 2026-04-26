import cv2
import time
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn

ESP32_URL = "http://192.168.145.252/stream" # <-- Put your ESP32 IP here

# Global variable to safely hold the newest JPEG image
latest_frame_bytes = None

def capture_camera():
    """This runs in the background. It is the ONLY thing allowed to talk to the ESP32."""
    global latest_frame_bytes
    print("🎥 Connecting to ESP32...")
    cap = cv2.VideoCapture(ESP32_URL)
    
    while True:
        success, frame = cap.read()
        if success:
            # --- YOUR AI LOGIC GOES HERE ---
            # event, val = process_poses(results)
            # cv2.putText(frame, "AI ACTIVE", (10, 30), ...)
            
            # Encode the frame and update the global variable safely
            ret, buffer = cv2.imencode('.jpg', frame)
            latest_frame_bytes = buffer.tobytes()
        else:
            print("⚠️ ESP32 dropped a frame. Reconnecting...")
            cap.release()
            time.sleep(1)
            cap = cv2.VideoCapture(ESP32_URL)

class VideoStreamHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global latest_frame_bytes
        
        if self.path == '/stream':
            self.send_response(200)
            self.send_header('Content-type', 'multipart/x-mixed-replace; boundary=frame')
            self.end_headers()
            
            try:
                while True:
                    # If we have a frame, send it to the client!
                    if latest_frame_bytes is not None:
                        self.wfile.write(b'--frame\r\n')
                        self.send_header('Content-Type', 'image/jpeg')
                        self.send_header('Content-Length', str(len(latest_frame_bytes)))
                        self.end_headers()
                        
                        self.wfile.write(latest_frame_bytes)
                        self.wfile.write(b'\r\n')
                        
                    # Sleep for 30ms (~33 FPS) so we don't spam the network with duplicates
                    time.sleep(0.03) 
            except Exception:
                # Client closed the tab or disconnected
                pass
        else:
            self.send_response(404)
            self.end_headers()

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    pass

if __name__ == '__main__':
    # 1. Start the camera worker in the background
    cam_thread = threading.Thread(target=capture_camera, daemon=True)
    cam_thread.start()

    # 2. Wait a split second to ensure the first frame is grabbed
    time.sleep(2)

    # 3. Start the Web Server
    port = 8080
    server = ThreadedHTTPServer(('0.0.0.0', port), VideoStreamHandler)
    print(f"📡 AI Relay Server running! Open http://localhost:{port}/stream")
    server.serve_forever()
