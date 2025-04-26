from flask import Flask, request, jsonify
from ultralytics import YOLO
from PIL import Image
import io

app = Flask(__name__)

model = YOLO('best.pt')  # Load YOLOv8 model

@app.route('/detect', methods=['GET', 'POST'])
def detect():
    if request.method == 'POST':
        if 'image' not in request.files:
            return jsonify({'error': 'No image uploaded'}), 400

        image = request.files['image']
        if image.filename == '':
            return jsonify({'error': 'No image selected'}), 400

        try:
            image_data = image.read()
            img = Image.open(io.BytesIO(image_data))

            results = model(img)

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

            return jsonify({
                'detections': detections,
                'total_corn': total_corn,
                'infested_corn': total_corn,
                'percentage_infested': percentage_infested
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify({'message': 'Server is working!'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
