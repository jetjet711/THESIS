import base64
import io
import json
import os
import sqlite3
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from PIL import Image
import torch
import cv2
import numpy as np
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# Load the YOLOv8 model
model = YOLO('best.pt')

DATABASE = 'detections.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    with open('schema.sql') as f:
        conn.executescript(f.read())
    conn.close()

if not os.path.exists(DATABASE):
    init_db()



@app.route('/')
def index():
    return render_template('index.html')

@app.route('/detect', methods=['POST'])
def detect():
    if request.method == 'POST':
        if 'image' not in request.files:
            return jsonify({'error': 'No image uploaded'}), 400

        image = request.files['image']
        if image.filename == '':
            return jsonify({'error': 'No image selected'}), 400

        try:
            # Read the image file
            image_data = image.read()
            img = Image.open(io.BytesIO(image_data))

            # Perform object detection
            results = model(img)

            # Prepare the results
            detections = []
            total_corn = 0
            infested_corn = 0
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    confidence = box.conf[0].item()
                    class_id = box.cls[0].item()
                    label = result.names[class_id]

                    if label == 'corn' or label == 'infested_corn':
                        total_corn += 1
                        if label == 'infested_corn':
                            infested_corn += 1
                        detections.append({
                            'box': [int(x1), int(y1), int(x2), int(y2)],
                            'label': label,
                            'confidence': float(confidence)
                        })

            percentage_infested = (infested_corn / total_corn) * 100 if total_corn > 0 else 0

            # Save detection results to the database
            conn = get_db_connection()
            now = datetime.now()
            date_time_string = now.strftime("%Y-%m-%d %H:%M:%S")
            conn.execute('INSERT INTO detections (timestamp, detections_json) VALUES (?, ?)',
                         (date_time_string, json.dumps(detections)))
            conn.commit()
            conn.close()

            return jsonify({
                'detections': detections,
                'total_corn': total_corn,
                'infested_corn': infested_corn,
                'percentage_infested': percentage_infested
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return jsonify({'message': 'Invalid request'}), 400

@app.route('/history')
def history():
    conn = get_db_connection()
    detections = conn.execute('SELECT * FROM detections ORDER BY id DESC LIMIT 10').fetchall()
    conn.close()
    detections = [dict(row) for row in detections]  # Convert Row objects to dictionaries
    return render_template('history.html', detections=detections)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
