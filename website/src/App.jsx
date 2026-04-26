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

  const playAlertSound = () => {
    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    audio.volume = 0.5;
    audio.play().catch(e => console.log("Sound blocked by browser"));
  };

  const handleUpdateLogStatus = (logId, newStatus) => {
    setLogs(prevLogs => 
      prevLogs.map(log => log.id === logId ? { ...log, status: newStatus } : log)
    );
    setSelectedLogForModal(null);
  };

  // EZ A KULCS: Amikor az autó visszaér, 'completed' státuszra váltunk
  const handleMissionComplete = (logId) => {
    setLogs(prevLogs => 
      prevLogs.map(log => log.id === logId ? { ...log, status: 'completed' } : log)
    );
    console.log(`✅ Mission finished. Log (${logId}) status: completed`);
  };

  useEffect(() => {
    if (!incomingData) return; 
    const targetCam = CAMERAS.find(cam => cam.id === incomingData.camera_id) || CAMERAS[0];

    if (incomingData.active === true && incomingData.event !== "NORMAL") {
      const incomingAlertType = incomingData.event; 

      setLogs(prevLogs => {
        // Ellenőrizzük, hogy ez a konkrét riasztás (id alapján) már benne van-e
        const isDuplicate = prevLogs.some(l => l.id === incomingData.timestamp);
        if (isDuplicate) return prevLogs;

        // Ha új, akkor mehet a lista elejére
        playAlertSound();
        setAlertedCamera(targetCam);
        setActiveAlert(incomingAlertType);

        const newLog = {
          id: incomingData.timestamp || Date.now(),
          type: incomingAlertType,
          time_string: incomingData.time_string,
          location: targetCam.name,
          title: `${ALERT_TYPES[incomingAlertType].labelText} Incident`,
          description: "Automated AI trigger activated. Live feed is available below.",
          image: incomingData.image_b64 ? `data:image/jpeg;base64,${incomingData.image_b64}` : null,
          stream_url: incomingData.stream_url || targetCam.stream_url || null,
          status: 'pending',
          isNew: true 
        };
        
        setTimeout(() => {
          setLogs(currentLogs => currentLogs.map(l => l.id === newLog.id ? { ...l, isNew: false } : l));
        }, 3000);

        return [newLog, ...prevLogs];
      });
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
        <Maps 
          logs={logs} 
          activeAlert={activeAlert} 
          alertedCamera={alertedCamera} 
          onCameraClick={(camera) => setSelectedSidebarCamera(camera)} 
          onMissionComplete={handleMissionComplete} 
        />
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
        sendMessage={sendMessage}
      />
    </div>
  );
}