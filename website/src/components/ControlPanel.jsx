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
              onClick={() => onSimulate('POSSIBLE_ATTACK')}
              className="btn-alert-type btn-alert-police"
            >Police</button>
            <button 
              onClick={() => onSimulate('HEALTH_EMERGENCY')}
              className="btn-alert-type btn-alert-amb"
            >Ambulance</button>
            <button 
              onClick={() => onSimulate('FIRE_EVENT')}
              className="btn-alert-type btn-alert-fire"
            >Fire Dept</button>
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
          ⚠️ INCIDENT: Responding unit: {activeAlert === 'POSSIBLE_ATTACK' ? 'Poliția' : activeAlert === 'HEALTH_EMERGENCY' ? 'UPU SMURD' : 'ISU Cluj'}
        </div>
      )}
    </div>
  );
}