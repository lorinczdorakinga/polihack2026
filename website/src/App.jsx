import React, { useState, useEffect } from 'react';
import { useWebSocket } from './resources/useWebsocket'; 
import Maps from './pages/maps';
import SideLogs from './pages/SideLogs';
import PointLogs from './pages/PointLogs';
import ControlPanel from './components/ControlPanel';
import IncidentModal from './components/IncidentModal';
import configData from './resources/config.json';
import './App.css';

const { ALERT_TYPES, CAMERAS } = configData;

export default function App() {
  const [logs, setLogs] = useState([]);
  
  const [activeAlert, setActiveAlert] = useState(null);
  const [alertedCamera, setAlertedCamera] = useState(null);
  const [selectedSidebarCamera, setSelectedSidebarCamera] = useState(null);
  const [selectedLogForModal, setSelectedLogForModal] = useState(null);

  const { data: incomingData, isConnected, sendMessage } = useWebSocket('ws://localhost:8080');
  // Hanglejátszó függvény áthelyezve a felső szintre
  const playAlertSound = () => {
    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    audio.volume = 0.5;
    audio.play().catch(e => console.log("A böngésző blokkolta a hangot:", e));
  };

  const handleUpdateLogStatus = (logId, newStatus) => {
    setLogs(prevLogs => 
      prevLogs.map(log => log.id === logId ? { ...log, status: newStatus } : log)
    );
    setSelectedLogForModal(null);
  };

  useEffect(() => {
    if (!incomingData) return; 
    const targetCam = CAMERAS.find(cam => cam.id === incomingData.camera_id) || CAMERAS[0];

    if (incomingData.active === true && incomingData.event !== "NORMAL") {
      const incomingAlertType = incomingData.event; 

      setActiveAlert(prevAlert => {
        if (prevAlert !== incomingAlertType) {
          setAlertedCamera(targetCam);
          playAlertSound(); 

          const newLog = {
            id: incomingData.timestamp || Date.now(),
            type: incomingAlertType,
            time: new Date().toLocaleTimeString('en-US', { hour12: false }),
            location: targetCam.name,
            message: `${ALERT_TYPES[incomingAlertType].labelText} (People detected: ${incomingData.people})`,
            title: `${ALERT_TYPES[incomingAlertType].labelText} Incident`,
            description: "Automated AI trigger activated. Live feed is available below.",
            image: incomingData.image_b64 ? `data:image/jpeg;base64,${incomingData.image_b64}` : null,
            stream_url: incomingData.stream_url || targetCam.stream_url || null,
            status: 'pending',
            isNew: true 
          };
          setLogs(prevLogs => [newLog, ...prevLogs]);

          setTimeout(() => {
            setLogs(currentLogs => currentLogs.map(l => l.id === newLog.id ? { ...l, isNew: false } : l));
          }, 3000);
        }
        return incomingAlertType;
      });
    } else if (incomingData.active === false || incomingData.event === "NORMAL") {
      setActiveAlert(null);
      setAlertedCamera(null);
    }
  }, [incomingData]);
    
  return (
    <div className="app-layout">
      {selectedSidebarCamera ? (
        <PointLogs 
          camera={selectedSidebarCamera} 
          logs={logs} 
          onBack={() => setSelectedSidebarCamera(null)}
          onLogClick={(log) => setSelectedLogForModal(log)} 
        />
      ) : (
        <SideLogs 
          logs={logs} 
          onLogClick={(log) => setSelectedLogForModal(log)} 
        />
      )}
      
      <div className="map-section">
        <Maps logs={logs} activeAlert={activeAlert} alertedCamera={alertedCamera} onCameraClick={(camera) => setSelectedSidebarCamera(camera)} />
      </div>

      <ControlPanel 
        alertTypes={ALERT_TYPES} 
        sendMessage={sendMessage} 
        selectedCamera={selectedSidebarCamera} 
      />
      <IncidentModal 
        log={selectedLogForModal} 
        onClose={() => setSelectedLogForModal(null)} 
        onUpdateStatus={handleUpdateLogStatus}
      />
    </div>
  );
}