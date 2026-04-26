import React from 'react';
import { MarkerF, CircleF, PolylineF, InfoWindowF } from '@react-google-maps/api';
import { ICONS, getPointAlongPath, getVehicleIcon } from './MapUtils';
import configData from '../resources/config.json';

const { ALERT_TYPES } = configData;

export const StationsLayer = ({ authorities, routeData, onPinClick }) => {
  return authorities.map((station) => {
    const isActiveSource = Object.values(routeData).some(r => r.station.id === station.id && r.status === 'approved');
    return (
      <React.Fragment key={station.id}>
        <MarkerF position={{ lat: station.lat, lng: station.lng }} icon={{ url: ICONS[station.type], scaledSize: new window.google.maps.Size(35, 35) }} onClick={() => onPinClick(station)} />
        {isActiveSource && <CircleF center={{ lat: station.lat, lng: station.lng }} radius={200} options={{ fillColor: '#ffffff', fillOpacity: 0.2, strokeColor: '#ffffff', strokeOpacity: 0.5, strokeWeight: 1, clickable: false }} />}
      </React.Fragment>
    );
  });
};

export const CamerasLayer = ({ cameras, logs, routeData, onCameraClick, onPinClick }) => {
  return cameras.map((cam) => {
    const activeMission = Object.values(routeData).find(r => r.camera.id === cam.id && r.status === 'approved');
    const isAlerting = logs?.some(l => l.location === cam.name && l.status === 'pending');
    
    // A kamera markere eltűnik, ha épp odafelé tart vagy ott van az egység (hogy tisztán látszódjon az út és az autó)
    if (activeMission && activeMission.missionState !== 'returning') return null;
    
    return (
      <React.Fragment key={cam.id}>
        <MarkerF position={{ lat: cam.lat, lng: cam.lng }} icon={{ url: isAlerting ? ICONS.camera_alert : ICONS.camera_normal, scaledSize: new window.google.maps.Size(45, 45) }} onClick={() => { onPinClick(cam); onCameraClick(cam); }} />
        {isAlerting && <CircleF center={{ lat: cam.lat, lng: cam.lng }} radius={300} options={{ fillColor: '#ff0000', fillOpacity: 0.3, strokeColor: '#ff0000', strokeOpacity: 0.9, strokeWeight: 2, clickable: false }} />}
      </React.Fragment>
    );
  });
};

export const MissionsLayer = ({ routeData, onLineClick, onVehicleClick }) => {
  return Object.entries(routeData).map(([logId, data]) => {
    const alertColor = ALERT_TYPES[data.logType].colorHex;
    return (
      <React.Fragment key={`mission_${logId}`}>
        
        {/* Célpont köralapú kiemelése a küldetés alatt */}
        {data.status === 'approved' && (
          <CircleF 
            center={{ lat: data.camera.lat, lng: data.camera.lng }} 
            radius={250} 
            options={{ fillColor: alertColor, fillOpacity: 0.2, strokeColor: alertColor, strokeOpacity: 0.6, strokeWeight: 2, clickable: false }} 
          />
        )}

        {/* ÚTVONAL: Mindig látszik az egész életciklus alatt! 
            Pendingnél erős (0.8), ha pedig már úton vannak (approved), akkor halvány (0.3) */}
        <PolylineF 
          path={data.path} 
          options={{ 
            strokeColor: alertColor, 
            strokeOpacity: data.status === 'pending' ? 0.8 : 0.3, 
            strokeWeight: 6 
          }}
          onClick={(e) => onLineClick(logId, data, e.latLng)}
        />

        {/* JÁRMŰ: Csak akkor jelenik meg, ha a diszpécser már elfogadta a hívást */}
        {data.status === 'approved' && (
          <MarkerF
            position={getPointAlongPath(data.path, data.progress)}
            icon={getVehicleIcon(alertColor, data.missionState === 'returning')}
            zIndex={999}
            onClick={() => onVehicleClick(logId, data)}
          />
        )}
        
      </React.Fragment>
    );
  });
};

export const PopupLayer = ({ infoPopup, selectedPin, onCloseInfo, onClosePin }) => {
  return (
    <>
      {infoPopup && (
        <InfoWindowF position={infoPopup.position} onCloseClick={onCloseInfo}>
          <div className="info-window" style={{ color: '#333' }}>
            <h4 style={{ margin: '0 0 5px 0', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>{infoPopup.title}</h4>
            <p style={{ whiteSpace: 'pre-line', margin: '0 0 10px 0', fontSize: '13px' }}>{infoPopup.desc}</p>
            {infoPopup.etaRemaining && <div style={{ color: '#d32f2f', fontWeight: 'bold' }}>⏳ ETA: {infoPopup.etaRemaining}</div>}
            <div style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>Route Base: {infoPopup.totalTime}</div>
          </div>
        </InfoWindowF>
      )}
      {selectedPin && (
        <InfoWindowF position={{ lat: selectedPin.lat, lng: selectedPin.lng }} onCloseClick={onClosePin}>
          <div className="info-window" style={{color: '#333'}}><h4>{selectedPin.name}</h4><p>{selectedPin.address}</p></div>
        </InfoWindowF>
      )}
    </>
  );
};