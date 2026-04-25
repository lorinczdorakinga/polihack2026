import React, { useState } from 'react';
import './SideLogs.css';

export default function SideLogs({ logs, onLogClick }) {
  // A szűrő állapota: null (mindent mutat), 'POSSIBLE_ATTACK', 'HEALTH_EMERGENCY', vagy 'FIRE_EVENT'
  const [activeFilter, setActiveFilter] = useState(null);

  const toggleFilter = (type) => {
    if (activeFilter === type) {
      setActiveFilter(null);
    } else {
      setActiveFilter(type);
    }
  };

  const filteredLogs = activeFilter 
    ? logs.filter(log => log.type === activeFilter) 
    : logs;

  return (
    <div className="sidebar-container">
      <div className="sidebar-header">
        Event Logs ({filteredLogs.length})
      </div>
      
      <div className="logs-list">
        {filteredLogs.map(log => (
          <div 
            key={log.id} 
            className={`log-item ${log.type}`}
            onClick={() => onLogClick(log)} 
            style={{ cursor: 'pointer' }} 
          >
            <div className="log-title">{log.title || 'Incident Report'}</div>
            <div className="log-description">{log.description || 'The AI system detected an anomaly. Waiting for detailed description...'}</div>
          </div>
        ))}
      </div>

      <div className="filter-section">
        {/* JAVÍTVA: A class név is POSSIBLE_ATTACK lett */}
        <button 
          className={`filter-btn POSSIBLE_ATTACK ${activeFilter === 'POSSIBLE_ATTACK' ? 'active' : ''}`}
          onClick={() => toggleFilter('POSSIBLE_ATTACK')}
          title="Police alerts only"
        />
        {/* JAVÍTVA: A class név is HEALTH_EMERGENCY lett */}
        <button 
          className={`filter-btn HEALTH_EMERGENCY ${activeFilter === 'HEALTH_EMERGENCY' ? 'active' : ''}`}
          onClick={() => toggleFilter('HEALTH_EMERGENCY')}
          title="Ambulance alerts only"
        />
        {/* JAVÍTVA: A class név is FIRE_EVENT lett */}
        <button 
          className={`filter-btn FIRE_EVENT ${activeFilter === 'FIRE_EVENT' ? 'active' : ''}`}
          onClick={() => toggleFilter('FIRE_EVENT')}
          title="Fire alerts only"
        />
      </div>
    </div>
  );
}