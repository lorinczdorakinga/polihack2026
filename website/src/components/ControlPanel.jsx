import React from 'react';
import './ControlPanel.css';

export default function ControlPanel({ activeAlert, onSimulate, onCancel, alertTypes }) {
  return (
    <div className="control-panel">
      <h3>Dispatcher Center</h3>
      <p>Location: Cluj-Napoca</p>
      
      {!activeAlert ? (
        <div className="simulation-controls">
          <span>Simulate Alert:</span>
          {/* Ezt a sort cseréltük le: */}
          <div className="btn-container">
            <button 
              onClick={() => onSimulate('police')}
              className="btn-alert-type btn-alert-police"
            >Police</button>
            <button 
              onClick={() => onSimulate('ambulance')}
              className="btn-alert-type btn-alert-amb"
            >Ambulance</button>
            <button 
              onClick={() => onSimulate('fire')}
              className="btn-alert-type btn-alert-fire"
            >Fire Departure</button>
          </div>
        </div>
      ) : (
        <div className="simulation-controls">
          <span>Status: {alertTypes[activeAlert].labelText}</span>
          <button onClick={onCancel} className="btn-alert-on">
            CANCEL ALERT
          </button>
        </div>
      )}

      {activeAlert && (
        <div className="status-bar alert" style={{ borderColor: alertTypes[activeAlert].colorHex, color: alertTypes[activeAlert].colorHex }}>
          ⚠️ INCIDENT: Responding unit: {activeAlert === 'police' ? 'Poliția' : activeAlert === 'ambulance' ? 'UPU SMURD' : 'ISU Cluj'}
        </div>
      )}
    </div>
  );
}