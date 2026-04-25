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
  const [logs, setLogs] = useState([
    { id: 1, type: 'FIRE_EVENT', time: '22:14:05', location: 'Smart_Camera_1', message: 'Fire / Smoke detected', title: 'Heavy Smoke Near Containers', description: 'The AI vision model detected thick smoke and rapid temperature increase near the waste containers. Probability: 94%.', image: null, stream_url: CAMERAS[0].stream_url, status: 'pending' },
    { id: 2, type: 'POSSIBLE_ATTACK', time: '23:01:22', location: 'Smart_Camera_1', message: 'Police intervention required', title: 'Physical Altercation', description: 'Multiple individuals identified in aggressive physical contact. Potential weapon detected.', image: null, stream_url: CAMERAS[0].stream_url, status: 'approved' }
  ]);
  
  const [activeAlert, setActiveAlert] = useState(null);
  const [alertedCamera, setAlertedCamera] = useState(null);
  const [selectedSidebarCamera, setSelectedSidebarCamera] = useState(null);
  const [selectedLogForModal, setSelectedLogForModal] = useState(null);

  const { data: incomingData, isConnected } = useWebSocket('ws://localhost:8080');

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
    setSelectedLogForModal(prev => prev && prev.id === logId ? { ...prev, status: newStatus } : prev);
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

  const handleSimulateAlert = (type) => {
    const targetCam = selectedSidebarCamera || CAMERAS[0]; 
    setActiveAlert(type);
    setAlertedCamera(targetCam);
    playAlertSound();
    
    const newLog = {
      id: Date.now(),
      type: type,
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      location: targetCam.name,
      message: ALERT_TYPES[type].labelText,
      title: `${ALERT_TYPES[type].labelText} Incident`, 
      description: `Automated AI trigger activated. No detailed visual analysis attached yet.`,
      image: null,
      stream_url: targetCam.stream_url,
      status: 'pending',
      isNew: true
    };
    
    setLogs(prevLogs => [newLog, ...prevLogs]);

    setTimeout(() => {
      setLogs(currentLogs => currentLogs.map(l => l.id === newLog.id ? { ...l, isNew: false } : l));
    }, 3000);
  };

  const handleCancelAlert = () => {
    setActiveAlert(null);
    setAlertedCamera(null);
  };

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

      <ControlPanel activeAlert={activeAlert} onSimulate={handleSimulateAlert} onCancel={handleCancelAlert} alertTypes={ALERT_TYPES} />

      <IncidentModal 
        log={selectedLogForModal} 
        onClose={() => setSelectedLogForModal(null)} 
        onUpdateStatus={handleUpdateLogStatus}
      />
    </div>
  );
}