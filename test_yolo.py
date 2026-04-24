from ultralytics import YOLO
import cv2

# Load model (nano = fast)
model = YOLO("yolov8n.pt")

# Open webcam
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Camera not working. Congrats.")
    exit()

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Run YOLO
    results = model(frame)

    # Draw results
    annotated_frame = results[0].plot()

    # Show
    cv2.imshow("YOLO Webcam", annotated_frame)

    # Exit on ESC
    if cv2.waitKey(1) == 27:
        break

cap.release()
cv2.destroyAllWindows()
