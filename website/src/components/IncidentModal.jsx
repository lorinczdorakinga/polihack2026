import React, { useState } from 'react';
import './IncidentModal.css';

export default function IncidentModal({ log, onClose, onUpdateStatus, sendMessage }) {
  const [angle, setAngle] = useState(90);

  // Az ESP32 IP címe a Python szkripted alapján
  const ESP_IP = "http://192.168.145.204";

  if (!log) return null;

  const status = log.status || 'pending'; 

  const handleMove = async (direction) => {
    let newAngle = angle;
    if (direction === 'left') newAngle -= 15;
    if (direction === 'right') newAngle += 15;
    if (direction === 'center') newAngle = 90;
    
    // Nem engedjük 0 alá és 180 fölé
    if (newAngle < 0) newAngle = 0;
    if (newAngle > 180) newAngle = 180;

    setAngle(newAngle);

    // 1. Direkt HTTP kérés az ESP32-nek (a Python requests.get megfelelője)
    try {
      await fetch(`${ESP_IP}/set?angle=${newAngle}`, {
        method: 'GET',
        mode: 'no-cors' // Fontos: kikerüli a böngésző biztonsági blokkolását (CORS)
      });
      console.log(`[INFO] Parancs elküldve az ESP-nek: ${newAngle} fok`);
    } catch (error) {
      console.error("[HIBA] Nem sikerült elérni az ESP32-t:", error);
    }

    // 2. (Opcionális) Ha még a térképen is forgatni akarod a kameraikont, 
    // meghagyhatjuk a WebSocket küldést is. Ha nem kell, ezt a részt törölheted.
    if (sendMessage) {
      sendMessage({
        action: "move_camera",
        camera_id: log.camera_id || "cam_1",
        angle: newAngle
      });
    }
  };

  const handleApprove = () => {
    onUpdateStatus(log.id, 'approved');
    onClose();
  };

  const handleDecline = () => {
    onUpdateStatus(log.id, 'declined');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>X</button>
        
        <h2 className="modal-title">{log.title || "Incident Report"}</h2>

        <div className="badges-container">
          {log.type === 'POSSIBLE_ATTACK' && <span className="incident-badge police">Police</span>}
          {log.type === 'HEALTH_EMERGENCY' && <span className="incident-badge ambulance">Ambulance</span>}
          {log.type === 'FIRE_EVENT' && <span className="incident-badge fire">Fire Station</span>}
        </div>

        <div className="modal-description">
          {log.description || "Review the live footage below to verify the AI's detection."}
        </div>

        <div className="modal-media-container" style={{ marginBottom: '15px' }}>
          {log.stream_url ? (
            <div style={{ position: 'relative' }}>
              <img 
                src={log.stream_url} 
                alt="Live Camera Feed" 
                style={{ width: '100%', borderRadius: '6px', display: 'block' }}
                onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/600x400?text=Camera+Offline"; }}
              />
              <div className="live-tag">LIVE</div>
            </div>
          ) : log.image ? (
            <img src={log.image} alt="Incident snapshot" style={{ width: '100%', borderRadius: '6px' }} />
          ) : (
            <div className="no-image-text">
              * Waiting for visual evidence... *
            </div>
          )}
        </div>

        <div className="camera-controls">
          <p>PTZ Camera Control ({angle}°)</p>
          <div className="control-buttons">
            <button className="ptz-btn" onClick={() => handleMove('left')}> ◀ Left </button>
            <button className="ptz-btn" onClick={() => handleMove('center')}> Center </button>
            <button className="ptz-btn" onClick={() => handleMove('right')}> Right ▶ </button>
          </div>
        </div>

        {status === 'pending' && (
          <div className="action-buttons">
            <button onClick={handleApprove} className="action-btn approve-btn">
              APPROVE (Dispatch Units)
            </button>
            <button onClick={handleDecline} className="action-btn decline-btn">
              DECLINE (False Alarm)
            </button>
          </div>
        )}

        {status === 'approved' && (
          <div className="status-feedback approved-feedback">
            ✓ Units dispatched successfully.
          </div>
        )}
        {status === 'declined' && (
          <div className="status-feedback declined-feedback">
            ✕ Alert declined and logged as False Positive.
          </div>
        )}

      </div>
    </div>
  );
}