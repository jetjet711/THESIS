import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import Home from './pages/Home';
import About from './pages/About';
import Team from './pages/Team';
import Summary from './pages/Summary';
import './App.css';
import Hls from 'hls.js';
import VideoStream from './components/VideoStream';

function App() {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const [counts, setCounts] = React.useState({ infested: 0, notInfested: 0 });

  useEffect(() => {
    const video = videoRef.current;

    if (video) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource('http://localhost:8000/live/stream.m3u8');
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play();
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = 'http://localhost:8000/live/stream.m3u8';
        video.addEventListener('loadedmetadata', () => {
          video.play();
        });
      }
    }

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const resetCounts = async () => {
    try {
      const response = await fetch('http://localhost:5000/reset_counts', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.message) {
        setCounts({ infested: 0, notInfested: 0 });
        alert(data.message);
      }
    } catch (error) {
      console.error('Error resetting counts:', error);
    }
  };

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>Fall Armyworm (FAW) Infestation Detection System</h1>
        </header>
        <nav className="App-navbar">
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/team">Team</Link></li>
          </ul>
        </nav>
          <VideoStream />
        <Routes>
          <Route path="/" element={<Home canvasRef={canvasRef} counts={counts} resetCounts={resetCounts} />} />
          <Route path="/about" element={<About />} />
          <Route path="/team" element={<Team />} />
          <Route path="/summary" element={<Summary />} />
        </Routes>
        <footer className="App-footer">
          <p>&copy; 2025 FAW Detection System. All rights reserved.</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
