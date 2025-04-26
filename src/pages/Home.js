import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home({ canvasRef }) {
  const navigate = useNavigate();
  const [totalCorn, setTotalCorn] = useState(0);
  const [infestedCorn, setInfestedCorn] = useState(0);
  const [percentageInfested, setPercentageInfested] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch the latest detection data from the backend (assuming it's stored in the database)
        const response = await fetch('http://localhost:5000/detect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({}) // Send an empty JSON object as the body
        });
        const data = await response.json();

        // Update the state with the new data
        setTotalCorn(data.total_corn);
        setInfestedCorn(data.infested_corn);
        setPercentageInfested(data.percentage_infested);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData(); // Fetch data on component mount

    // Optionally, you can set up an interval to fetch data periodically
    // For example, every 5 seconds:
    // const intervalId = setInterval(fetchData, 5000);

    // Clean up the interval when the component unmounts
    // return () => clearInterval(intervalId);
  }, []);

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
