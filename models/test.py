import cv2

cap = cv2.VideoCapture(0)
print("Opened:", cap.isOpened())
print("Width:", cap.get(cv2.CAP_PROP_FRAME_WIDTH))
print("Height:", cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

while True:
    ret, frame = cap.read()
    print("ret:", ret, "frame shape:", frame.shape if ret else "None")
    if ret:
        cv2.imshow("test", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
