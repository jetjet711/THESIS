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
  const videoCaptureRef = useRef(null);
  const iframeRef = useRef(null);
  const boxesRef = useRef([]);   // ✅ Store boxes separately
  const classesRef = useRef([]); // ✅ Store classes separately

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
    const captureIframeScreen = async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: false,
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

  // ✅ This draws the video continuously at 30fps
  useEffect(() => {
    const drawVideo = () => {
      const video = videoCaptureRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!video || video.readyState < 2) {
        requestAnimationFrame(drawVideo);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // ✅ Draw bounding boxes after drawing video
      drawBoxes(ctx);

      requestAnimationFrame(drawVideo);
    };

    requestAnimationFrame(drawVideo);
  }, []);

  // ✅ Separate capturing and sending to server
  useEffect(() => {
    const captureAndDetect = () => {
      const video = videoCaptureRef.current;
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      if (!video || video.readyState < 2) return;

      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

      tempCanvas.toBlob(async (blob) => {
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
            boxesRef.current = result.boxes;   // ✅ Update boxes
            classesRef.current = result.classes; // ✅ Update classes
            updateCounts(result);
          } catch (err) {
            console.error('Error sending frame to server:', err);
          }
        }
      }, 'image/jpeg');
    };

    const intervalId = setInterval(captureAndDetect, 1000); // Send every 1 sec
    return () => clearInterval(intervalId);
  }, []);

  const drawBoxes = (ctx) => {
    const boxes = boxesRef.current;
    const classes = classesRef.current;

    ctx.lineWidth = 2;
    ctx.font = '18px Arial';

    boxes.forEach((box, idx) => {
      const [x_center, y_center, width, height] = box;
      const x = (x_center - width / 2) * ctx.canvas.width;
      const y = (y_center - height / 2) * ctx.canvas.height;
      const w = width * ctx.canvas.width;
      const h = height * ctx.canvas.height;

      ctx.strokeStyle = classes[idx] === 0 ? 'red' : 'green';
      ctx.fillStyle = classes[idx] === 0 ? 'red' : 'green';

      ctx.strokeRect(x, y, w, h);
      ctx.fillText(classes[idx] === 0 ? 'Infested' : 'Healthy', x, y > 20 ? y - 5 : y + 20);
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

          <video
            ref={videoCaptureRef}
            style={{ display: 'none' }}
            playsInline
            muted
          />

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
