import React, { useState, useEffect } from 'react';
import Maps from './pages/maps';
import SideLogs from './pages/SideLogs';
import PointLogs from './pages/PointLogs';
import ControlPanel from './components/ControlPanel';
import { useWebSocket } from './resources/useWebsocket';
import IncidentModal from './components/IncidentModal';
import './App.css';

export const ALERT_TYPES = {
  POSSIBLE_ATTACK: { id: 'POSSIBLE_ATTACK', colorHex: "#0044cc", labelText: "Possible Attack", responderText: "Poliția en route to the scene." },
  HEALTH_EMERGENCY: { id: 'HEALTH_EMERGENCY', colorHex: "#cc0000", labelText: "Health Emergency", responderText: "UPU SMURD en route to the scene." },
  FIRE_EVENT: { id: 'FIRE_EVENT', colorHex: "#e67e22", labelText: "Fire Alert", responderText: "ISU Cluj en route to the scene." }
};

// A KAMERÁK KÖZPONTI LISTÁJA (4 darab zöld pont)
export const CAMERAS = [
  { id: 'cam_1', name: 'Smart_Camera_1', lat: 46.7825, lng: 23.6051, address: 'Str. Henri Barbusse 44', contact: '+40 711 111 111' },
  { id: 'cam_2', name: 'Smart_Camera_2', lat: 46.7725, lng: 23.6265, address: 'Str. Alexandru Vaida Voevod 53', contact: '+40 722 222 222' },
  { id: 'cam_3', name: 'Smart_Camera_3', lat: 46.7693, lng: 23.5898, address: 'Piața Unirii 1', contact: '+40 733 333 333' },
  { id: 'cam_4', name: 'Smart_Camera_4', lat: 46.7684, lng: 23.5768, address: 'Parcul Central', contact: '+40 744 444 444' }
];

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