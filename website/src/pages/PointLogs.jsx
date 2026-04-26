import React from 'react';
import './PointLogs.css';

export default function PointLogs({ camera, logs, onBack, onLogClick }) {
  // 1. Kiszűrjük a kamerát, ÉS elrejtjük az elutasított / lezárt hívásokat
  // PointLogs.jsx szűrési része:
  const cameraLogs = logs.filter(log => 
    log.location === camera.name &&
    (log.status === 'pending' || log.status === 'approved')
  );
  

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
          cameraLogs.map(log => {
            // 2. Egységesítjük az időkijelzést a SideLogs-szal
            const logTime = log.time_string || "--:--:--";

            return (
              <div 
                key={log.id} 
                className={`log-item ${log.type} ${log.isNew ? 'new-alert' : ''}`}
                onClick={() => onLogClick(log)} 
                style={{ cursor: 'pointer' }} 
              >
                <div className="log-time">{logTime}</div>
                <div className="log-title">{log.title || 'Incident Report'}</div>
                <div className="log-description">{log.description || 'The AI system detected an anomaly. Waiting for detailed description...'}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}