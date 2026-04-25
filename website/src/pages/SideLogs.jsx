import React, { useState } from 'react';
import './SideLogs.css';

export default function SideLogs({ logs, onLogClick }) {
  // A szűrő állapota: null (mindent mutat), 'police', 'ambulance', vagy 'fire'
  const [activeFilter, setActiveFilter] = useState(null);

  // Ha rákattint egy gombra, beállítja a szűrőt. Ha ugyanarra kattint, kikapcsolja.
  const toggleFilter = (type) => {
    if (activeFilter === type) {
      setActiveFilter(null);
    } else {
      setActiveFilter(type);
    }
  };

  // Csak azokat a logokat mutatjuk, amik átmennek a szűrőn
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
            onClick={() => onLogClick(log)} /* <-- KATTINTÁS ESEMÉNY! */
            style={{ cursor: 'pointer' }} /* <-- Egér ikon változtatása */
          >
            <div className="log-title">{log.title || 'Incident Report'}</div>
            <div className="log-description">{log.description || 'The AI system detected an anomaly. Waiting for detailed description...'}</div>
          </div>
        ))}
      </div>

      <div className="filter-section">
        <button 
          className={`filter-btn police ${activeFilter === 'police' ? 'active' : ''}`}
          onClick={() => toggleFilter('police')}
          title="Only Police Calls"
        />
        <button 
          className={`filter-btn ambulance ${activeFilter === 'ambulance' ? 'active' : ''}`}
          onClick={() => toggleFilter('ambulance')}
          title="Only Ambulance Calls"
        />
        <button 
          className={`filter-btn fire ${activeFilter === 'fire department' ? 'active' : ''}`}
          onClick={() => toggleFilter('fire department')}
          title="Only Fire Department Calls"
        />
      </div>
    </div>
  );
}