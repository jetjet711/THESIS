import React, { useEffect, useRef } from 'react';

const DroneFeed = ({ setTotalCorn, setInfestedCorn, setPercentageInfested }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set the VDO.Ninja stream URL
    video.src = "https://vdo.ninja/?view=W7VtHrL&raw"; // Replace STREAM_ID with your actual stream ID
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;

    // Add error handling
    video.onerror = (e) => {
      console.error("Failed to load VDO.Ninja stream", e);
    };

    video.onloadedmetadata = () => {
      console.log("VDO.Ninja stream loaded successfully");
      video.play();
    };

    const captureFrame = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        // Send the frame to your backend for detection
        const formData = new FormData();
        formData.append('frame', blob);

        fetch('http://localhost:5000/detect', {
          method: 'POST',
          body: formData,
        })
          .then((response) => response.json())
          .then((data) => {
            console.log('Detection results:', data);
            setTotalCorn(data.total_corn || 0);
            setInfestedCorn(data.infested_corn || 0);
            setPercentageInfested(data.percentage_infested || 0);

            // Draw bounding boxes
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            data.detections.forEach((detection) => {
              ctx.strokeRect(
                detection.xmin,
                detection.ymin,
                detection.xmax - detection.xmin,
                detection.ymax - detection.ymin
              );
            });
          })
          .catch((error) => console.error('Error detecting frame:', error));
      }, 'image/jpeg');
    };

    // Capture frames every second
    const intervalId = setInterval(captureFrame, 1000);

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [setTotalCorn, setInfestedCorn, setPercentageInfested]);

  return (
    <div>
      <h2>Drone Live Feed</h2>
      <video
        ref={videoRef}
        width="640"
        height="480"
        autoPlay
        playsInline
        muted
      />
      <canvas ref={canvasRef} width="640" height="480" />
    </div>
  );
};

export default DroneFeed;
