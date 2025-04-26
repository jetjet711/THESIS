import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home({ canvasRef }) {
  const navigate = useNavigate();
  const [totalCorn, setTotalCorn] = useState(0);
  const [infestedCorn, setInfestedCorn] = useState(0);
  const [percentageInfested, setPercentageInfested] = useState(0);
  const [serverStatus, setServerStatus] = useState('Checking...'); // <-- NEW

  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch('http://localhost:5000/detect');
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

    // Optionally, check server every 5 seconds
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="layout-container">
      <div className="detection-section">
        <h3>DETECTION SUMMARY</h3>
        
        {/* 👇 Add this */}
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
        <div className="options">
          <button onClick={() => navigate('/summary')} className="view-summary-button">
            View Summary
          </button>
        </div>
      </div>
      <div className="camera-section">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

export default Home;
