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
from flask_cors import CORS
from queue import Queue
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app and SocketIO
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, 
                   cors_allowed_origins="*",
                   async_mode='threading',
                   logger=True,
                   engineio_logger=True)

# Load YOLOv8 model
try:
    model = YOLO("best.pt")
    logger.info("YOLO model loaded successfully")
except Exception as e:
    logger.error(f"Error loading YOLO model: {e}")
    exit(1)

# Thread-safe frame buffer using Queue
frame_buffer = Queue(maxsize=10)  # Limit buffer size to prevent memory issues
detection_counts = {
    "infested": 0,
    "not_infested": 0
}
tracked_objects = set()

# Database setup with connection pooling
def get_db_connection():
    conn = sqlite3.connect('detections.db', check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db_connection() as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS detections
                     (id INTEGER PRIMARY KEY, 
                      timestamp TEXT, 
                      class TEXT, 
                      confidence REAL)''')
        conn.execute('''CREATE TABLE IF NOT EXISTS session_summaries
                     (id INTEGER PRIMARY KEY, 
                      timestamp TEXT, 
                      infested_count INTEGER, 
                      not_infested_count INTEGER)''')
        conn.commit()

init_db()

@app.route('/detect', methods=['POST'])
def detect_faw():
    try:
        start_time = time.time()
        
        # Read the uploaded image
        img_bytes = request.data
        if not img_bytes or len(img_bytes) == 0:
            logger.warning("No image data received")
            return {"error": "No image data received"}, 400

        try:
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None or img.size == 0:
                logger.warning("Invalid or empty image data")
                return {"error": "Invalid or empty image data"}, 400
        except Exception as e:
            logger.error(f"Image decoding error: {e}")
            return {"error": "Invalid image data"}, 400

        # Run YOLOv8 inference
        try:
            results = model(img, imgsz=640, conf=0.5, iou=0.5)
            if not results or len(results) == 0:
                return jsonify({
                    'infested_count': detection_counts["infested"],
                    'not_infested_count': detection_counts["not_infested"],
                    'boxes': [],
                    'classes': [],
                    'confidences': []
                })
        except Exception as e:
            logger.error(f"Inference error: {e}")
            return {"error": "Model inference failed"}, 500

        # Process results
        boxes = []
        classes = []
        confidences = []
        current_infested = 0
        current_not_infested = 0

        if results[0].boxes is not None:
            boxes = results[0].boxes.xywhn.cpu().numpy().tolist()
            classes = results[0].boxes.cls.cpu().numpy().tolist()
            confidences = results[0].boxes.conf.cpu().numpy().tolist()

            # Update counts
            for cls in classes:
                if cls == 0:  # Assuming 0 is infested
                    current_infested += 1
                else:
                    current_not_infested += 1

            # Update global counts in a thread-safe way
            with threading.Lock():
                detection_counts["infested"] += current_infested
                detection_counts["not_infested"] += current_not_infested

            # Store detections in database
            try:
                conn = get_db_connection()
                timestamp = datetime.now().isoformat()
                for cls, conf in zip(classes, confidences):
                    conn.execute(
                        "INSERT INTO detections (timestamp, class, confidence) VALUES (?, ?, ?)",
                        (timestamp, "infested" if cls == 0 else "not_infested", float(conf))
                    )
                conn.commit()
            except Exception as e:
                logger.error(f"Database error: {e}")
            except Exception as e:
                logger.error(f"Database error: {e}")
            finally:
                conn.close()

        # Generate annotated image
        try:
            annotated_img = results[0].plot()
            _, buffer = cv2.imencode('.jpg', annotated_img, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            frame_data = base64.b64encode(buffer.tobytes()).decode('utf-8')
            
            # Non-blocking frame buffer addition
            if not frame_buffer.full():
                frame_buffer.put(frame_data)
        except Exception as e:
            logger.error(f"Image processing error: {e}")

        logger.info(f"Detection completed in {time.time() - start_time:.2f}s")
        
        return jsonify({
            'infested_count': detection_counts["infested"],
            'not_infested_count': detection_counts["not_infested"],
            'boxes': boxes,
            'classes': classes,
            'confidences': confidences
        })

    except Exception as e:
        logger.error(f"Unexpected error in /detect endpoint: {e}", exc_info=True)
        return {"error": "Internal server error"}, 500

@app.route('/reset_counts', methods=['POST'])
def reset_counts():
    try:
        with threading.Lock():
            total = detection_counts["infested"] + detection_counts["not_infested"]
            infested_percentage = (detection_counts["infested"] / total) * 100 if total > 0 else 0
            not_infested_percentage = (detection_counts["not_infested"] / total) * 100 if total > 0 else 0

            try:
                conn = get_db_connection()
                conn.execute(
                    "INSERT INTO session_summaries (timestamp, infested_count, not_infested_count) VALUES (?, ?, ?)",
                    (datetime.now().isoformat(), detection_counts["infested"], detection_counts["not_infested"]))
                conn.commit()
            except Exception as e:
                logger.error(f"Database error: {e}")
                return {"error": "Failed to save summary"}, 500
            finally:
                conn.close()

            detection_counts = {"infested": 0, "not_infested": 0}

            return jsonify({
                "message": "Detection counts reset successfully",
                "infested_percentage": infested_percentage,
                "not_infested_percentage": not_infested_percentage
            })
    except Exception as e:
        logger.error(f"Error in reset_counts: {e}")
        return {"error": "Internal server error"}, 500

@app.route('/get_summaries', methods=['GET'])
def get_summaries():
    try:
        conn = get_db_connection()
        summaries = conn.execute("SELECT * FROM session_summaries ORDER BY timestamp DESC").fetchall()
        return jsonify([dict(row) for row in summaries])
    except Exception as e:
        logger.error(f"Error fetching summaries: {e}")
        return {"error": "Failed to fetch summaries"}, 500
    finally:
        conn.close()

@app.route('/get_percentages', methods=['GET'])
def get_percentages():
    try:
        with threading.Lock():
            total = detection_counts["infested"] + detection_counts["not_infested"]
            infested_percentage = (detection_counts["infested"] / total) * 100 if total > 0 else 0
            not_infested_percentage = (detection_counts["not_infested"] / total) * 100 if total > 0 else 0

            return jsonify({
                "infested_percentage": infested_percentage,
                "not_infested_percentage": not_infested_percentage
            })
    except Exception as e:
        logger.error(f"Error in get_percentages: {e}")
        return {"error": "Internal server error"}, 500

@app.route('/delete_summary/<int:id>', methods=['DELETE'])
def delete_summary(id):
    try:
        conn = get_db_connection()
        conn.execute("DELETE FROM session_summaries WHERE id = ?", (id,))
        conn.commit()
        return jsonify({"message": f"Summary with id {id} deleted successfully"})
    except Exception as e:
        logger.error(f"Error deleting summary: {e}")
        return {"error": "Failed to delete summary"}, 500
    finally:
        conn.close()

def stream_frames():
    while True:
        try:
            if not frame_buffer.empty():
                frame_data = frame_buffer.get()
                socketio.emit('video_frame', {"image": frame_data})
            time.sleep(0.033)  # ~30fps
        except Exception as e:
            logger.error(f"Error in frame streaming: {e}")
            time.sleep(1)

if __name__ == '__main__':
    try:
        # Start frame streaming thread
        threading.Thread(target=stream_frames, daemon=True).start()
        
        logger.info("Starting server on http://0.0.0.0:5000")
        socketio.run(app, 
                    host='0.0.0.0', 
                    port=5000, 
                    debug=False,  # Disable debug in production
                    allow_unsafe_werkzeug=True,
                    use_reloader=False)
    except Exception as e:
        logger.error(f"Server error: {e}")