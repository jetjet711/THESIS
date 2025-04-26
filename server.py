from flask import Flask, request, jsonify
from ultralytics import YOLO
from PIL import Image
import io

app = Flask(__name__)

# Load the YOLOv8 model
model = YOLO('best.pt')  # Replace 'best.pt' with the path to your YOLOv8 model

@app.route('/detect', methods=['POST'])
def detect():
    if 'frame' not in request.files:
        return jsonify({'error': 'No frame provided'}), 400

    file = request.files['frame']
    img = Image.open(io.BytesIO(file.read()))

    # Perform detection
    results = model.predict(source=img, save=False, conf=0.25)  # Adjust confidence threshold as needed
    detections = results[0].boxes.data.tolist()  # Extract detection results

    # Example: Calculate summary statistics
    total_corn = len(detections)
    infested_corn = sum(1 for d in detections if int(d[5]) == 1)  # Replace '1' with the class ID for 'infested'
    percentage_infested = (infested_corn / total_corn) * 100 if total_corn > 0 else 0

    return jsonify({
        'total_corn': total_corn,
        'infested_corn': infested_corn,
        'percentage_infested': percentage_infested,
        'detections': detections,
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
