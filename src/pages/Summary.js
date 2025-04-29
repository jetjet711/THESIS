import React from 'react';
import { useLocation } from 'react-router-dom';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

// Register required Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

function Summary() {
  const location = useLocation();
  const { totalCorn, infestedCorn, percentageInfested } = location.state || {};

  const healthyCorn = totalCorn - infestedCorn;

  const data = {
    labels: ['Infested Corn', 'Healthy Corn'],
    datasets: [
      {
        data: [infestedCorn, healthyCorn],
        backgroundColor: ['#FF6384', '#36A2EB'],
        hoverBackgroundColor: ['#FF6384', '#36A2EB'],
      },
    ],
  };

  return (
    <div className="summary-container">
      <h1>Detection Summary</h1>
      <div className="summary-details">
        <p>Total Corn Plants: {totalCorn}</p>
        <p>Infested Corn Plants: {infestedCorn}</p>
        <p>Percentage Infested: {percentageInfested ? percentageInfested.toFixed(2) : '0.00'}%</p>
      </div>
      <div className="chart-container">
        <h2>Infestation Breakdown</h2>
        <Pie data={data} />
      </div>
    </div>
  );
}

export default Summary;
