import React from 'react';
import './ControlPanel.css';

export default function ControlPanel({ alertTypes, sendMessage, selectedCamera }) {
  
  const handleSimulateClick = (type) => {
    if (sendMessage) {
      const targetCamId = selectedCamera ? selectedCamera.id : "cam_1";
      
      sendMessage({
        action: "simulate_alert",
        type: type,
        camera_id: targetCamId
      });
      console.log(`📡 Szimuláció indítva: ${type} -> ${targetCamId}`);
    } else {
      console.error("Nincs WebSocket kapcsolat!");
    }
  };

  return (
    <div className="control-panel">
      <h3>Dispatcher Center</h3>
      
      <div className="status-indicator" style={{ marginBottom: '15px' }}>
        Location: Cluj-Napoca
      </div>
      
      <div className="simulation-section">
        <p className="trigger-label">
          Trigger Event ({selectedCamera ? selectedCamera.name : 'cam_1'}):
        </p>
        
        {/* Itt már csak a gombok vannak egy sorban */}
        <div className="simulate-buttons">
          <button onClick={() => handleSimulateClick('POSSIBLE_ATTACK')} className="sim-btn attack">Attack</button>
          <button onClick={() => handleSimulateClick('HEALTH_EMERGENCY')} className="sim-btn health">Health</button>
          <button onClick={() => handleSimulateClick('FIRE_EVENT')} className="sim-btn fire">Fire</button>
        </div>
      </div>

    </div>
  );
}