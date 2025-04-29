import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const [totalCorn, setTotalCorn] = useState(0);
  const [infestedCorn, setInfestedCorn] = useState(0);
  const [percentageInfested, setPercentageInfested] = useState(0);
  const [serverStatus, setServerStatus] = useState('Checking...');
  const canvasRef = useRef(null);
  const videoCaptureRef = useRef(null);   // ✅ Hidden video
  const iframeRef = useRef(null);

  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch('http://localhost:5000/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: new Blob([]),
        });
        if (response.ok) {
          setServerStatus('Connected ✅');
        } else {
          setServerStatus('Disconnected ❌');
        }
      } catch (error) {
        setServerStatus('Disconnected ❌');
        console.error('Error connecting to server:', error);
      }
    };

    checkServer();
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Ask user permission to capture iframe screen
    const captureIframeScreen = async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 }, 
          audio: false
        });

        const video = videoCaptureRef.current;
        video.srcObject = stream;
        video.play();
      } catch (err) {
        console.error('Error capturing iframe screen:', err);
      }
    };

    captureIframeScreen();
  }, []);

  useEffect(() => {
    const captureAndDetect = () => {
      const video = videoCaptureRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!video || video.readyState < 2) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (blob && blob.size > 0) {
          try {
            const response = await fetch('http://localhost:5000/detect', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/octet-stream',
              },
              body: blob,
            });
            const result = await response.json();
            drawBoxes(result.boxes, result.classes);
            updateCounts(result);
          } catch (err) {
            console.error('Error sending frame to server:', err);
          }
        }
      }, 'image/jpeg');
    };

    const intervalId = setInterval(captureAndDetect, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const drawBoxes = (boxes, classes) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 2;
    context.font = '18px Arial';

    boxes.forEach((box, idx) => {
      const [x_center, y_center, width, height] = box;
      const x = (x_center - width / 2) * canvas.width;
      const y = (y_center - height / 2) * canvas.height;
      const w = width * canvas.width;
      const h = height * canvas.height;

      context.strokeStyle = classes[idx] === 0 ? 'red' : 'green';
      context.fillStyle = classes[idx] === 0 ? 'red' : 'green';

      context.strokeRect(x, y, w, h);
      context.fillText(classes[idx] === 0 ? 'Infested' : 'Healthy', x, y > 20 ? y - 5 : y + 20);
    });
  };

  const updateCounts = (result) => {
    const total = result.infested_count + result.not_infested_count;
    setTotalCorn(total);
    setInfestedCorn(result.infested_count);
    setPercentageInfested(total > 0 ? (result.infested_count / total) * 100 : 0);
  };

  return (
    <>
      <div className="layout-container">
        {/* Detection Summary */}
        <div className="detection-section">
          <h3>DETECTION SUMMARY</h3>
          <h2 style={{ color: serverStatus === 'Connected ✅' ? 'green' : 'red' }}>
            Server Status: {serverStatus}
          </h2>

          <div className="detection-cards">
            <div className="card total">
              <h4>Total Corn Plants Detected</h4>
              <p>{totalCorn}</p>
            </div>
            <div className="card infested">
              <h4>Infested Corn Plants</h4>
              <p>{infestedCorn}</p>
            </div>
            <div className="card percentage">
              <h4>Percentage Infested</h4>
              <p>{percentageInfested ? percentageInfested.toFixed(2) : '0.00'}%</p>
            </div>
          </div>
        </div>

        {/* Drone Live Feed */}
        <div className="iframe-container" style={{ position: 'relative', width: '100%', height: '700px' }}>
          <h3>DRONE LIVE FEED</h3>

          <iframe
            ref={iframeRef}
            title="Drone Live Feeds"
            src="http://localhost:3001/videoproxy/?view=hemN544&autoplay=1&muted=1"
            allow="camera; microphone; autoplay; fullscreen"
            width="100%"
            height="100%"
            frameBorder="0"
            allowFullScreen
            style={{ zIndex: 1 }}
          ></iframe>

          {/* Hidden video capture */}
          <video
            ref={videoCaptureRef}
            style={{ display: 'none' }}
            playsInline
            muted
          />

          {/* Canvas on top */}
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        </div>
      </div>

      {/* Options */}
      <div className="options">
        <button onClick={() => navigate('/summary')} className="view-summary-button">
          View Summary
        </button>
      </div>
    </>
  );
}

export default Home;

