import React from 'react';
import './IncidentModal.css';

export default function IncidentModal({ log, onClose }) {
  // Ha nincs kiválasztott log, ne jelenítsen meg semmit
  if (!log) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      {/* Az e.stopPropagation() megakadályozza, hogy bezáródjon az ablak, ha magára az ablakra kattintanak, ne a sötét háttérre */}
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        
        <button className="close-btn" onClick={onClose}>X</button>
        
        {/* AI által generált Cím */}
        <h2 className="modal-title">{log.title || "Incident Report"}</h2>

        {/* Dinamikus hatósági jelvény */}
        <div className="badges-container">
          {log.type === 'police' && <span className="incident-badge police">Police</span>}
          {log.type === 'ambulance' && <span className="incident-badge ambulance">Ambulance</span>}
          {log.type === 'fire' && <span className="incident-badge fire">Fire Station</span>}
        </div>

        {/* AI által generált Leírás */}
        <div className="modal-description">
          {log.description || "The AI system detected an anomaly. Waiting for detailed description..."}
        </div>

        {/* Kép (Base64 JSON-ből) */}
        <div className="modal-image-container">
          {log.image ? (
            <img src={log.image} alt="Incident snapshot" />
          ) : (
            <div className="no-image-text">* No visual data attached to this incident *</div>
          )}
        </div>

      </div>
    </div>
  );
}