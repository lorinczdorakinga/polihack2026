import React, { useState, useMemo, useEffect } from 'react';
import { GoogleMap, useLoadScript, MarkerF, InfoWindowF, CircleF, PolylineF } from '@react-google-maps/api';
import configData from '../resources/config.json';
import './Maps.css';

const GOOGLE_MAPS_API_KEY = "AIzaSyAyWSi2Y0tfwpe1phWxIBEAC8xV2WJ6jk4";
const { ALERT_TYPES, CAMERAS, AUTHORITIES, MAP_CENTER } = configData;

const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
];

const ICONS = {
  police: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
  ambulance: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
  fire: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png",
  camera_normal: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
  camera_alert: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" 
};

const getAuthorityType = (alertId) => {
  if (alertId === 'FIRE_EVENT') return 'fire';
  if (alertId === 'POSSIBLE_ATTACK') return 'police';
  if (alertId === 'HEALTH_EMERGENCY') return 'ambulance';
  return null;
}

const getPointAlongPath = (path, progress) => {
  if (!path || path.length === 0) return null;
  if (progress <= 0) return path[0];
  if (progress >= 1) return path[path.length - 1];
  const exactIndex = progress * (path.length - 1);
  const lowerIndex = Math.floor(exactIndex);
  const upperIndex = Math.ceil(exactIndex);
  const fraction = exactIndex - lowerIndex;
  
  const p1 = path[lowerIndex];
  const p2 = path[upperIndex];
  return {
    lat: p1.lat + (p2.lat - p1.lat) * fraction,
    lng: p1.lng + (p2.lng - p1.lng) * fraction
  };
};

export default function Maps({ logs, activeAlert, alertedCamera, onCameraClick }) {
  const [selectedPin, setSelectedPin] = useState(null);
  const [routeData, setRouteData] = useState({});
  const [infoPopup, setInfoPopup] = useState(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const options = useMemo(() => ({
    styles: mapStyles,
    disableDefaultUI: true,
    zoomControl: true,
  }), []);

  useEffect(() => {
    if (!window.google || !logs) return;

    logs.forEach(log => {
      const existingRoute = routeData[log.id];

      if (log.status === 'declined' && existingRoute) {
        setRouteData(prev => {
          const next = { ...prev };
          delete next[log.id];
          return next;
        });
        if (infoPopup?.logId === log.id) setInfoPopup(null);
        return;
      }

      if (log.status === 'approved' && existingRoute && existingRoute.status === 'pending') {
        setRouteData(prev => ({
          ...prev,
          [log.id]: { ...prev[log.id], status: 'approved', missionState: 'forward' }
        }));
        return;
      }

      if (log.status === 'pending' && !existingRoute) {
        const targetCam = CAMERAS.find(c => c.name === log.location);
        if (!targetCam) return;

        const authType = getAuthorityType(log.type);
        const relevantStations = AUTHORITIES.filter(a => a.type === authType);
        
        let closestStation = relevantStations[0];
        let minDistance = Infinity;
        relevantStations.forEach(st => {
          const dist = Math.sqrt(Math.pow(st.lat - targetCam.lat, 2) + Math.pow(st.lng - targetCam.lng, 2));
          if (dist < minDistance) { minDistance = dist; closestStation = st; }
        });

        const directionsService = new window.google.maps.DirectionsService();
        directionsService.route({
          origin: { lat: closestStation.lat, lng: closestStation.lng },
          destination: { lat: targetCam.lat, lng: targetCam.lng },
          travelMode: window.google.maps.TravelMode.DRIVING
        }, (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            const path = result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
            setRouteData(prev => ({
              ...prev,
              [log.id]: {
                status: 'pending',
                missionState: 'idle',
                logType: log.type,
                path: path,
                etaText: result.routes[0].legs[0].duration.text,
                etaValue: result.routes[0].legs[0].duration.value,
                station: closestStation,
                camera: targetCam,
                progress: 0,
                waitTimer: 0
              }
            }));
          }
        });
      }
    });
  }, [logs]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRouteData(prev => {
        let hasUpdates = false;
        const nextData = { ...prev };
        
        for (const id in nextData) {
          const route = nextData[id];
          if (route.status === 'approved') {
            if (route.missionState === 'forward') {
              route.progress += 0.005;
              if (route.progress >= 1) {
                route.progress = 1;
                route.missionState = 'waiting';
                route.waitTimer = Date.now();
              }
              hasUpdates = true;
            } else if (route.missionState === 'waiting') {
              if (Date.now() - route.waitTimer >= 10000) {
                route.missionState = 'returning';
              }
              hasUpdates = true;
            } else if (route.missionState === 'returning') {
              route.progress -= 0.005;
              if (route.progress <= 0) {
                delete nextData[id]; // Megérkezett vissza az állomásra, töröljük
              }
              hasUpdates = true;
            }
          }
        }
        return hasUpdates ? nextData : prev;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const getVehicleIcon = (colorHex, isReturning) => ({
    path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: 6,
    fillColor: colorHex,
    fillOpacity: 1,
    strokeWeight: 2,
    strokeColor: '#ffffff',
    rotation: isReturning ? 180 : 0 // Megfordul a nyíl, ha visszafelé megy
  });

  if (loadError) return <div style={{color: 'white', padding: '20px'}}>Error loading map.</div>;
  if (!isLoaded || !window.google) return <div style={{color: 'white', padding: '20px'}}>Loading map...</div>;

  return (
    <div className="map-container-wrapper">
      <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={MAP_CENTER} zoom={13} options={options}>
        
        {AUTHORITIES.map((station) => {
          // Kiemelés, ha az állomás érintett egy aktív küldetésben
          const isActiveSource = Object.values(routeData).some(r => r.station.id === station.id && r.status === 'approved');
          return (
            <React.Fragment key={station.id}>
              <MarkerF position={{ lat: station.lat, lng: station.lng }} icon={{ url: ICONS[station.type], scaledSize: new window.google.maps.Size(35, 35) }} onClick={() => setSelectedPin(station)} />
              {isActiveSource && (
                <CircleF center={{ lat: station.lat, lng: station.lng }} radius={200} options={{ fillColor: '#ffffff', fillOpacity: 0.2, strokeColor: '#ffffff', strokeOpacity: 0.5, strokeWeight: 1, clickable: false }} />
              )}
            </React.Fragment>
          );
        })}

        {CAMERAS.map((cam) => {
          // Egy kamera csak akkor látszik, ha nincs aktív 'approved' küldetés rá
          const activeMission = Object.values(routeData).find(r => r.camera.id === cam.id && r.status === 'approved');
          const isAlerting = logs?.some(l => l.location === cam.name && l.status === 'pending');

          if (activeMission && activeMission.missionState !== 'returning') return null;

          return (
            <React.Fragment key={cam.id}>
              <MarkerF position={{ lat: cam.lat, lng: cam.lng }} icon={{ url: isAlerting ? ICONS.camera_alert : ICONS.camera_normal, scaledSize: new window.google.maps.Size(45, 45) }} onClick={() => { setSelectedPin(cam); onCameraClick(cam); }} />
              {isAlerting && (
                <CircleF center={{ lat: cam.lat, lng: cam.lng }} radius={300} options={{ fillColor: '#ff0000', fillOpacity: 0.3, strokeColor: '#ff0000', strokeOpacity: 0.9, strokeWeight: 2, clickable: false }} />
              )}
            </React.Fragment>
          );
        })}

        {Object.entries(routeData).map(([logId, data]) => {
          const alertColor = ALERT_TYPES[data.logType].colorHex;

          return (
            <React.Fragment key={`mission_${logId}`}>
              {/* Pontok kiemelése a küldetés alatt */}
              {data.status === 'approved' && (
                <CircleF center={{ lat: data.camera.lat, lng: data.camera.lng }} radius={250} options={{ fillColor: alertColor, fillOpacity: 0.2, strokeColor: alertColor, strokeOpacity: 0.6, strokeWeight: 2, clickable: false }} />
              )}

              {/* Útvonal (Csak pendingnél és forward/returning állapotnál, várakozásnál elhalványulhat) */}
              {(data.status === 'pending' || data.missionState === 'returning') && (
                <PolylineF 
                  path={data.path} 
                  options={{ strokeColor: alertColor, strokeOpacity: data.status === 'pending' ? 0.8 : 0.3, strokeWeight: 6 }}
                  onClick={(e) => setInfoPopup({ logId, position: e.latLng, title: "Mission Details", desc: `Unit from: ${data.station.name}\nTarget: ${data.camera.name}`, totalTime: data.etaText })}
                />
              )}

              {/* Jármű animáció */}
              {data.status === 'approved' && (
                <MarkerF
                  position={getPointAlongPath(data.path, data.progress)}
                  icon={getVehicleIcon(alertColor, data.missionState === 'returning')}
                  zIndex={999}
                  onClick={() => {
                    const remainingSeconds = data.missionState === 'forward' ? data.etaValue * (1 - data.progress) : data.etaValue * data.progress;
                    const remainingMins = Math.ceil(remainingSeconds / 60);
                    setInfoPopup({
                      logId,
                      position: getPointAlongPath(data.path, data.progress),
                      title: data.missionState === 'waiting' ? "Unit on Scene" : "Unit en Route",
                      desc: data.missionState === 'waiting' ? "Processing incident..." : `Target: ${data.camera.name}`,
                      etaRemaining: data.missionState === 'waiting' ? "Stationary (10s)" : `${remainingMins} mins`,
                      totalTime: data.etaText
                    });
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

        {infoPopup && (
          <InfoWindowF position={infoPopup.position} onCloseClick={() => setInfoPopup(null)}>
            <div className="info-window" style={{ color: '#333' }}>
              <h4 style={{ margin: '0 0 5px 0', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>{infoPopup.title}</h4>
              <p style={{ whiteSpace: 'pre-line', margin: '0 0 10px 0', fontSize: '13px' }}>{infoPopup.desc}</p>
              {infoPopup.etaRemaining && <div style={{ color: '#d32f2f', fontWeight: 'bold' }}>⏳ ETA: {infoPopup.etaRemaining}</div>}
              <div style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>Route Base: {infoPopup.totalTime}</div>
            </div>
          </InfoWindowF>
        )}

        {selectedPin && (
          <InfoWindowF position={{ lat: selectedPin.lat, lng: selectedPin.lng }} onCloseClick={() => setSelectedPin(null)}>
            <div className="info-window" style={{color: '#333'}}>
              <h4>{selectedPin.name}</h4>
              <p>{selectedPin.address}</p>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  );
}