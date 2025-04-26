import React from 'react';

const DroneFeed = () => {
  return (
    <div>
      <h2>Drone Live Feed</h2>
      <iframe
        src="https://vdo.ninja/?push=kytxyzG&autoplay=1&muted=1"
        allow="camera; microphone; autoplay; fullscreen"
        width="640"
        height="480"
        frameborder="0"
        allowfullscreen
      ></iframe>
    </div>
  );
};

export default DroneFeed;
