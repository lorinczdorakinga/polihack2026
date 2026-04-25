import React, { useState, useEffect } from 'react';
import Maps from './pages/maps';
import SideLogs from './pages/SideLogs';
import PointLogs from './pages/PointLogs';
import ControlPanel from './components/ControlPanel';
import { useWebSocket } from './resources/useWebsocket';
import IncidentModal from './components/IncidentModal';
import configData from './resources/config.json'; // ÚJ: A JSON fájl beolvasása
import './App.css';

export const { ALERT_TYPES, CAMERAS } = configData;

function App() {
  const [logs, setLogs] = useState([
    { id: 1, type: 'FIRE_EVENT', time: '22:14:05', location: 'Smart_Camera_1', message: 'Fire / Smoke detected', title: 'Heavy Smoke Near Containers', description: 'The AI vision model detected thick smoke and rapid temperature increase near the waste containers. Probability: 94%.', image: null },
    { id: 2, type: 'POSSIBLE_ATTACK', time: '23:01:22', location: 'Smart_Camera_1', message: 'Police intervention required', title: 'Physical Altercation', description: 'Multiple individuals identified in aggressive physical contact. Potential weapon detected.', image: null }
  ]);
  
  const [activeAlert, setActiveAlert] = useState(null);
  const [alertedCamera, setAlertedCamera] = useState(null); // Melyik kamera riaszt?
  const [selectedSidebarCamera, setSelectedSidebarCamera] = useState(null); // Melyik kamera adatlapja van nyitva?
  const [selectedLogForModal, setSelectedLogForModal] = useState(null);

  const { data: incomingData, isConnected } = useWebSocket('ws://localhost:5000/ws');

  const handleSimulateAlert = (type) => {
    // Ha a felhasználó épp néz egy kamerát, akkor az riaszt. Ha nem, akkor az 1-es kamera.
    const targetCam = selectedSidebarCamera || CAMERAS[0]; 
    
    setActiveAlert(type);
    setAlertedCamera(targetCam);
    
    const newLog = {
      id: Date.now(),
      type: type,
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      location: targetCam.name,
      message: ALERT_TYPES[type].labelText,
      // Felkészítés a bejövő JSON adatokra:
      title: `${ALERT_TYPES[type].labelText} Incident`, 
      description: `Automated AI trigger activated. No detailed visual analysis attached yet.`,
      image: null
    };
    setLogs(prevLogs => [newLog, ...prevLogs]);
  };

  const handleCancelAlert = () => {
    setActiveAlert(null);
    setAlertedCamera(null);
  };

  useEffect(() => {
    if (!incomingData) return;
    const targetCam = CAMERAS.find(cam => cam.id === incomingData.camera_id) || CAMERAS[0];
    // HA VESZÉLY VAN
    if (incomingData.active === true && incomingData.event !== "NORMAL") {
      
      const incomingAlertType = incomingData.event.toUpperCase();
      setActiveAlert(prevAlert => {
        // Csak akkor hozunk létre új logot, ha ez egy ÚJ riasztás
        if (prevAlert !== incomingAlertType) {
          setAlertedCamera(targetCam);
          
          const newLog = {
            id: incomingData.timestamp || Date.now(),
            type: incomingAlertType,
            time: new Date().toLocaleTimeString('en-US', { hour12: false }),
            location: targetCam.name,
            // Hozzáadjuk az emberek számát is a JSON-ből
            message: `${ALERT_TYPES[incomingAlertType].labelText} (People detected: ${incomingData.people})`
          };
          setLogs(prevLogs => [newLog, ...prevLogs]);
        }
        return incomingAlertType;
      });

    } 
    // HA VÉGE A VESZÉLYNEK
    else if (incomingData.active === false || incomingData.event === "NORMAL") {
      setActiveAlert(null);
      setAlertedCamera(null);
    }
  }, [incomingData]);

  return (
    <div className="app-layout">
      
      {/* DINAMIKUS BAL OLDALI SÁV CSERE */}
      {selectedSidebarCamera ? (
        <PointLogs 
          camera={selectedSidebarCamera} 
          logs={logs} 
          onBack={() => setSelectedSidebarCamera(null)}
          onLogClick={(log) => setSelectedLogForModal(log)} /* <-- Átadjuk az eseményt! */
        />
      ) : (
        <SideLogs 
          logs={logs} 
          onLogClick={(log) => setSelectedLogForModal(log)} /* <-- Átadjuk az eseményt! */
        />
      )}
      
      <div className="map-section">
        <Maps 
          activeAlert={activeAlert} 
          alertedCamera={alertedCamera}
          onCameraClick={(camera) => setSelectedSidebarCamera(camera)} 
        />
      </div>

      <ControlPanel 
        activeAlert={activeAlert}
        onSimulate={handleSimulateAlert}
        onCancel={handleCancelAlert}
        alertTypes={ALERT_TYPES}
      />
      <IncidentModal 
        log={selectedLogForModal} 
        onClose={() => setSelectedLogForModal(null)} 
      />

    </div>
  );
}

export default App;