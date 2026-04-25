import React, { useState } from 'react';
import './IncidentModal.css';

export default function IncidentModal({ log, onClose }) {
  const [status, setStatus] = useState('pending');

  if (!log) return null;

  const handleApprove = () => {
    setStatus('approved');
    console.log("Riasztás megerősítve! Hatóságok indítása...");
    setTimeout(onClose, 1500);
  };

  const handleDecline = () => {
    setStatus('declined');
    console.log("Téves riasztás elutasítva.");
    setTimeout(onClose, 1500);
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

        {/* ÉLŐ STREAM VAGY KÉP MEGJELENÍTÉSE */}
        <div className="modal-media-container" style={{ marginBottom: '20px' }}>
          {log.stream_url ? (
            <div style={{ position: 'relative' }}>
              {/* Ez játssza le a kamerád nyers MJPEG streamjét! */}
              <img 
                src={log.stream_url} 
                alt="Live Camera Feed" 
                style={{ width: '100%', borderRadius: '6px', border: '1px solid #444', display: 'block' }}
                onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/600x400?text=Camera+Offline"; }}
              />
              <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#d32f2f', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                ● LIVE
              </div>
            </div>
          ) : log.image ? (
            <img src={log.image} alt="Incident snapshot" style={{ width: '100%', borderRadius: '6px' }} />
          ) : (
            <div className="no-image-text" style={{ padding: '40px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: '#121212', borderRadius: '6px' }}>
              * Waiting for visual evidence... *
            </div>
          )}
        </div>

        {/* DISZPÉCSER DÖNTÉSI PANEL */}
        {status === 'pending' && (
          <div className="action-buttons" style={{ display: 'flex', gap: '15px' }}>
            <button 
              onClick={handleApprove}
              style={{ flex: 1, padding: '15px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              APPROVE (Dispatch Units)
            </button>
            <button 
              onClick={handleDecline}
              style={{ flex: 1, padding: '15px', backgroundColor: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              DECLINE (False Alarm)
            </button>
          </div>
        )}

        {/* VISSZAJELZÉS */}
        {status === 'approved' && (
          <div style={{ padding: '15px', backgroundColor: '#2e7d32', color: 'white', textAlign: 'center', borderRadius: '4px', fontWeight: 'bold' }}>
            ✓ Units dispatched successfully.
          </div>
        )}
        {status === 'declined' && (
          <div style={{ padding: '15px', backgroundColor: '#424242', color: '#aaa', textAlign: 'center', borderRadius: '4px', fontStyle: 'italic' }}>
            ✕ Alert declined and logged as False Positive.
          </div>
        )}

      </div>
    </div>
  );
}