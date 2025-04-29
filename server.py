from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from ultralytics import YOLO
import cv2
import numpy as np
import time
import threading
from datetime import datetime
import sqlite3
import base64
import hashlib
from flask_cors import CORS

# Initialize Flask app and SocketIO
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*")

# Load YOLOv8 model
try:
    model = YOLO("best.pt")
except Exception as e:
    print(f"Error loading YOLO model: {e}")
    exit(1)

# Global buffer to store video frames (base64 strings)
frame_buffer = []
detection_counts = {
    "infested": 0,
    "not_infested": 0
}

# Add this global variable
last_detection_time = time.time()

# Global variable to store detected objects
tracked_objects = set()

# Initialize SQLite database
conn = sqlite3.connect('detections.db', check_same_thread=False)
c = conn.cursor()
c.execute('''CREATE TABLE IF NOT EXISTS detections
             (id INTEGER PRIMARY KEY, timestamp TEXT, class TEXT, confidence REAL)''')
c.execute('''CREATE TABLE IF NOT EXISTS session_summaries
             (id INTEGER PRIMARY KEY, timestamp TEXT, infested_count INTEGER, not_infested_count INTEGER)''')
conn.commit()

@app.route('/detect', methods=['GET', 'POST'])
def detect_faw():
    global frame_buffer, detection_counts, last_detection_time, tracked_objects

    if request.method == 'GET':
        return jsonify({"status": "Server running"})

    try:
        img_bytes = request.data
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None or img.size == 0:
            return {"error": "Invalid or empty image data"}, 400

        # Run YOLOv8 inference
        results = model(img, imgsz=640, conf=0.5, iou=0.5)

        annotated_img = results[0].plot()

        # Compress and encode as base64
        _, buffer = cv2.imencode('.jpg', annotated_img)
        if len(frame_buffer) < 2:
            frame_buffer.append(base64.b64encode(buffer.tobytes()).decode('utf-8'))

        current_time = time.time()
        if current_time - last_detection_time > 60:
            detection_counts["infested"] = 0
            detection_counts["not_infested"] = 0
            tracked_objects.clear()

        detected = False
        for box in results[0].boxes:
            class_id = int(box.cls)
            confidence = float(box.conf)
            class_name = model.names[class_id]
            x, y, w, h = box.xywh.tolist()[0]

            object_id = hashlib.md5(f"{class_name}_{x}_{y}_{w}_{h}".encode()).hexdigest()

            if object_id not in tracked_objects:
                tracked_objects.add(object_id)

                if class_name == "infested corn plant":
                    detection_counts["infested"] += 1
                    detected = True
                elif class_name == "not infested corn plant":
                    detection_counts["not_infested"] += 1
                    detected = True

                try:
                    c.execute("INSERT INTO detections (timestamp, class, confidence) VALUES (?, ?, ?)",
                              (datetime.now(), class_name, confidence))
                    conn.commit()
                except sqlite3.Error as db_error:
                    print(f"Database error: {db_error}")

        if detected:
            last_detection_time = current_time

        socketio.emit('video_frame', {"image": frame_buffer.pop(0)} if frame_buffer else {})
        socketio.emit('detection_counts', {
            'infested_count': detection_counts["infested"],
            'not_infested_count': detection_counts["not_infested"]
        })

        return jsonify({
            'infested_count': detection_counts["infested"],
            'not_infested_count': detection_counts["not_infested"],
            'boxes': results[0].boxes.xywhn.tolist() if results[0].boxes is not None else [],
            'classes': results[0].boxes.cls.tolist() if results[0].boxes is not None else [],
            'confidences': results[0].boxes.conf.tolist() if results[0].boxes is not None else []
        })

    except Exception as e:
        print(f"Error in /detect endpoint: {e}")  # Log the error
        return {"error": str(e)}, 500

@app.route('/reset_counts', methods=['POST'])
def reset_counts():
    global detection_counts
    total = detection_counts["infested"] + detection_counts["not_infested"]
    infested_percentage = (detection_counts["infested"] / total) * 100 if total > 0 else 0
    not_infested_percentage = (detection_counts["not_infested"] / total) * 100 if total > 0 else 0

    c.execute("INSERT INTO session_summaries (timestamp, infested_count, not_infested_count) VALUES (?, ?, ?)",
              (datetime.now(), detection_counts["infested"], detection_counts["not_infested"]))
    conn.commit()

    detection_counts = {"infested": 0, "not_infested": 0}

    return jsonify({
        "message": "Detection counts reset successfully",
        "infested_percentage": infested_percentage,
        "not_infested_percentage": not_infested_percentage
    })

@app.route('/get_summaries', methods=['GET'])
def get_summaries():
    c.execute("SELECT * FROM session_summaries")
    summaries = c.fetchall()
    return jsonify(summaries)

@app.route('/get_percentages', methods=['GET'])
def get_percentages():
    global detection_counts
    total = detection_counts["infested"] + detection_counts["not_infested"]
    infested_percentage = (detection_counts["infested"] / total) * 100 if total > 0 else 0
    not_infested_percentage = (detection_counts["not_infested"] / total) * 100 if total > 0 else 0

    print(f"Returning percentages - Infested: {detection_counts['infested']}, Not Infested: {detection_counts['not_infested']}")
    return jsonify({
        "infested_percentage": infested_percentage,
        "not_infested_percentage": not_infested_percentage
    })

@app.route('/delete_summary/<int:id>', methods=['DELETE'])
def delete_summary(id):
    c.execute("DELETE FROM session_summaries WHERE id = ?", (id,))
    conn.commit()
    return jsonify({"message": f"Summary with id {id} deleted successfully"})

def stream_frames():
    while True:
        if frame_buffer:
            socketio.emit('video_frame', {"image": frame_buffer.pop(0)})
        time.sleep(0.1)

if __name__ == '__main__':
    threading.Thread(target=stream_frames, daemon=True).start()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
