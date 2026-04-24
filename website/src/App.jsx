import React, { useState } from 'react';
import Maps from './pages/maps';
import SideLogs from './pages/SideLogs';
import ControlPanel from './components/ControlPanel';
import './App.css';

// Az alert típusokat ide emeltük ki, mert az App és a Maps is használja
export const ALERT_TYPES = {
  police: { id: 'police', colorHex: "#0044cc", labelText: "Police intervention required", responderText: "Poliția en route to the scene." },
  ambulance: { id: 'ambulance', colorHex: "#cc0000", labelText: "Injured person / Fall", responderText: "UPU SMURD en route to the scene." },
  fire: { id: 'fire', colorHex: "#e67e22", labelText: "Fire / Smoke", responderText: "ISU Cluj en route to the scene." }
};

function App() {
  const [logs, setLogs] = useState([]);
  
  // A riasztás állapota mostantól a fő appban él!
  const [activeAlert, setActiveAlert] = useState(null);

  // Gombnyomás a Control Panelben
  const handleSimulateAlert = (type) => {
    setActiveAlert(type);
    const newLog = {
      id: Date.now(),
      type: type,
      time: new Date().toLocaleTimeString('hu-HU'),
      location: 'Smart_Camera_1',
      message: ALERT_TYPES[type].labelText
    };
    setLogs(prevLogs => [newLog, ...prevLogs]);
  };

  // Kikapcsolás a Control Panelben
  const handleCancelAlert = () => {
    setActiveAlert(null);
  };

  return (
    <div className="app-layout">
      
      {/* 1. Bal sáv */}
      <SideLogs logs={logs} />
      
      {/* 2. Térkép (Megkapja, hogy van-e épp riasztás) */}
      <div className="map-section">
        <Maps activeAlert={activeAlert} />
      </div>

      {/* 3. A Fixált Vezérlőpult (Független minden mástól) */}
      <ControlPanel 
        activeAlert={activeAlert}
        onSimulate={handleSimulateAlert}
        onCancel={handleCancelAlert}
        alertTypes={ALERT_TYPES}
      />

    </div>
  );
}

export default App;