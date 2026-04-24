import React, { useState } from 'react';
import Maps from './pages/maps';
import SideLogs from './pages/SideLogs';
import PointLogs from './pages/PointLogs';
import ControlPanel from './components/ControlPanel';
import './App.css';

export const ALERT_TYPES = {
  police: { id: 'police', colorHex: "#0044cc", labelText: "Police intervention required", responderText: "Poliția en route to the scene." },
  ambulance: { id: 'ambulance', colorHex: "#cc0000", labelText: "Injured person / Fall", responderText: "UPU SMURD en route to the scene." },
  fire: { id: 'fire', colorHex: "#e67e22", labelText: "Fire / Smoke", responderText: "ISU Cluj en route to the scene." }
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
    { id: 1, type: 'fire', time: '22:14:05', location: 'Smart_Camera_1', message: 'Fire / Smoke detected' },
    { id: 2, type: 'police', time: '23:01:22', location: 'Smart_Camera_1', message: 'Police intervention required' }
  ]);
  
  const [activeAlert, setActiveAlert] = useState(null);
  const [alertedCamera, setAlertedCamera] = useState(null); // Melyik kamera riaszt?
  const [selectedSidebarCamera, setSelectedSidebarCamera] = useState(null); // Melyik kamera adatlapja van nyitva?

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
      message: ALERT_TYPES[type].labelText
    };
    setLogs(prevLogs => [newLog, ...prevLogs]);
  };

  const handleCancelAlert = () => {
    setActiveAlert(null);
    setAlertedCamera(null);
  };

  return (
    <div className="app-layout">
      
      {/* DINAMIKUS BAL OLDALI SÁV CSERE */}
      {selectedSidebarCamera ? (
        <PointLogs 
          camera={selectedSidebarCamera} 
          logs={logs} 
          onBack={() => setSelectedSidebarCamera(null)} 
        />
      ) : (
        <SideLogs logs={logs} />
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

    </div>
  );
}

export default App;