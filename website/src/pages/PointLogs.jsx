import React from 'react';
import './PointLogs.css';

export default function PointLogs({ camera, logs, onBack, onLogClick }) {
  // Kiszűrjük azokat a logokat, amik ennél a kameránál történtek
  const cameraLogs = logs.filter(log => log.location === camera.name);

  return (
    <div className="point-logs-wrapper">
      <button className="back-btn" onClick={onBack}>
        ← Back to all logs
      </button>

      <div className="camera-info-card">
        <h2>{camera.name}</h2>
        <div className="info-row">
          <strong>Address:</strong> {camera.address}
        </div>
        <div className="info-row">
          <strong>Contact:</strong> {camera.contact}
        </div>
        <div className="info-row">
          <strong>Status:</strong> <span style={{color: '#4CAF50'}}>Active</span>
        </div>
      </div>

      <div style={{ padding: '15px 15px 0 15px', fontWeight: 'bold', fontSize: '18px' }}>
        Recent calls ({cameraLogs.length})
      </div>

      <div className="logs-list">
        {cameraLogs.length === 0 ? (
          <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>No recent calls for this location.</p>
        ) : (
          cameraLogs.map(log => (
            <div 
            key={log.id} 
            className={`log-item ${log.type} ${log.isNew ? 'new-alert' : ''}`} /* <-- EZ VÁLTOZOTT */
            onClick={() => onLogClick(log)} 
            style={{ cursor: 'pointer' }} 
          >
              <div className="log-title">{log.title || 'Incident Report'}</div>
              <div className="log-description">{log.description || 'The AI system detected an anomaly. Waiting for detailed description...'}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}