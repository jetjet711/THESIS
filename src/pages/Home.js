import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import DroneFeed from '../components/DroneFeed';

function Home() {
  const navigate = useNavigate();
  const [totalCorn, setTotalCorn] = useState(0);
  const [infestedCorn, setInfestedCorn] = useState(0);
  const [percentageInfested, setPercentageInfested] = useState(0);

  return (
    <div className="layout-container">
      <div className="detection-section">
        <h3>DETECTION SUMMARY</h3>
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
            <p>{percentageInfested.toFixed(2)}%</p>
          </div>
        </div>
        <div className="options">
          <button onClick={() => navigate('/summary')} className="view-summary-button">
            View Summary
          </button>
        </div>
      </div>
      <div className="camera-section">
        <DroneFeed
          setTotalCorn={setTotalCorn}
          setInfestedCorn={setInfestedCorn}
          setPercentageInfested={setPercentageInfested}
        />
      </div>
    </div>
  );
}

export default Home;
