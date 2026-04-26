import React, { useState } from 'react';
import './SideLogs.css';

export default function SideLogs({ logs, onLogClick }) {
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
        {filteredLogs.map(log => {
          
          // --- BIZTONSÁGOS IDŐFELDOLGOZÓ ---
          let logTime = "--:--:--";
          if (log.timestamp) {
            // Ha szám (a Python szerver küldte Unix másodpercként)
            if (typeof log.timestamp === 'number') {
              logTime = new Date(log.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            } 
            // Ha szöveg (pl. régi beégetett tesztadatok vagy hibás YOLO JSON)
            else {
              const parsedDate = new Date(log.timestamp);
              // Csak akkor írjuk ki, ha tényleg érvényes dátum
              if (!isNaN(parsedDate.getTime())) {
                logTime = parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              }
            }
          }

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
        })}
      </div>

      <div className="filter-section">
        <button 
          className={`filter-btn POSSIBLE_ATTACK ${activeFilter === 'POSSIBLE_ATTACK' ? 'active' : ''}`}
          onClick={() => toggleFilter('POSSIBLE_ATTACK')}
          title="Police alerts only"
        >
          Attack
        </button>

        <button 
          className={`filter-btn HEALTH_EMERGENCY ${activeFilter === 'HEALTH_EMERGENCY' ? 'active' : ''}`}
          onClick={() => toggleFilter('HEALTH_EMERGENCY')}
          title="Ambulance alerts only"
        >
          Health
        </button>

        <button 
          className={`filter-btn FIRE_EVENT ${activeFilter === 'FIRE_EVENT' ? 'active' : ''}`}
          onClick={() => toggleFilter('FIRE_EVENT')}
          title="Fire alerts only"
        >
          Fire
        </button>
      </div>
    </div>
  );
}