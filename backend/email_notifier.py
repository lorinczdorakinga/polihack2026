import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


# ── Configuration ────────────────────────────────────────────────────────────
SENDER_EMAIL = "polihackbyteme@gmail.com"   # <-- change this
SENDER_PASSWORD = "heutdkjqstmqlozh"   # <-- change this (use Gmail App Password)

EVENT_RECIPIENTS = {
    "FIRE_EVENT":         "rcsavasi@gmail.com",
    "HEALTH_EMERGENCY":   "ritacsavasi2@gmail.com",
    "POSSIBLE_ATTACK":    "csavasirita22@gmail.com",
}

EVENT_SUBJECTS = {
    "FIRE_EVENT":         "🔥 Fire Alert Detected!",
    "HEALTH_EMERGENCY":   "🚑 Health Emergency Detected!",
    "POSSIBLE_ATTACK":    "⚠️ Possible Attack Detected!",
}
# ─────────────────────────────────────────────────────────────────────────────


def load_json(filepath: str) -> dict:
    with open(filepath, "r") as f:
        return json.load(f)


def send_email(recipient: str, subject: str, body: str):
    msg = MIMEMultipart()
    msg["From"] = SENDER_EMAIL
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, recipient, msg.as_string())

    print(f"Email sent to {recipient} | Subject: {subject}")


def process_event(data: dict):
    event = data.get("event", "NORMAL")
    camera = data.get("camera_id", "unknown")
    timestamp = data.get("timestamp", "N/A")
    people = data.get("people", 0)

    if event == "NORMAL":
        print(f"Event is NORMAL on {camera} — no action taken.")
        return

    if event not in EVENT_RECIPIENTS:
        print(f"Unknown event type: {event} — no action taken.")
        return

    recipient = EVENT_RECIPIENTS[event]
    subject = EVENT_SUBJECTS[event]
    body = (
        f"Alert from camera: {camera}\n"
        f"Event type: {event}\n"
        f"Timestamp: {timestamp}\n"
        f"People detected: {people}\n"
    )

    send_email(recipient, subject, body)


if __name__ == "__main__":
    json_file = "event.json"   # <-- path to your JSON file
    data = load_json(json_file)
    process_event(data)