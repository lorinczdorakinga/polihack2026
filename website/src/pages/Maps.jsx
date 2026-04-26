import React, { useState, useMemo, useEffect } from 'react';
import { GoogleMap, useLoadScript } from '@react-google-maps/api';
import { mapStyles, getAuthorityType, getPointAlongPath } from '../components/MapUtils';
import { StationsLayer, CamerasLayer, MissionsLayer, PopupLayer } from '../components/MapLayers';
import configData from '../resources/config.json';
import './Maps.css';

const GOOGLE_MAPS_API_KEY = "AIzaSyAyWSi2Y0tfwpe1phWxIBEAC8xV2WJ6jk4";
const { CAMERAS, AUTHORITIES, MAP_CENTER } = configData;

export default function Maps({ logs, activeAlert, alertedCamera, onCameraClick }) {
  const [selectedPin, setSelectedPin] = useState(null);
  const [routeData, setRouteData] = useState({});
  const [infoPopup, setInfoPopup] = useState(null);

  const { isLoaded, loadError } = useLoadScript({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });
  const options = useMemo(() => ({ styles: mapStyles, disableDefaultUI: true, zoomControl: true }), []);

  useEffect(() => {
    if (!window.google || !logs) return;

    logs.forEach(log => {
      const existingRoute = routeData[log.id];

      if (log.status === 'declined' && existingRoute) {
        setRouteData(prev => { const next = { ...prev }; delete next[log.id]; return next; });
        if (infoPopup?.logId === log.id) setInfoPopup(null);
        return;
      }

      // 2. KÉRÉS: Amikor accept-elt a diszpécser, minden ablak tűnjön el
      if (log.status === 'approved' && existingRoute && existingRoute.status === 'pending') {
        setRouteData(prev => ({ 
          ...prev, 
          [log.id]: { ...prev[log.id], status: 'approved', missionState: 'forward' } 
        }));
        setInfoPopup(null);
        setSelectedPin(null);
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
              [log.id]: { status: 'pending', missionState: 'idle', logType: log.type, path: path, etaText: result.routes[0].legs[0].duration.text, etaValue: result.routes[0].legs[0].duration.value, station: closestStation, camera: targetCam, progress: 0, waitTimer: 0 }
            }));
            setInfoPopup(null);   // Útvonal/Autó infók törlése
            setSelectedPin(null);
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
              if (route.progress >= 1) { route.progress = 1; route.missionState = 'waiting'; route.waitTimer = Date.now(); }
              hasUpdates = true;
            } else if (route.missionState === 'waiting') {
              if (Date.now() - route.waitTimer >= 10000) route.missionState = 'returning';
              hasUpdates = true;
            } else if (route.missionState === 'returning') {
              route.progress -= 0.005;
              if (route.progress <= 0) delete nextData[id];
              hasUpdates = true;
            }
          }
        }
        return hasUpdates ? nextData : prev;
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // 3. ÉS 5. KÉRÉS: Vonalra kattintáskor InfoWindow + PointLog megnyitása
  const handleLineClick = (logId, data, latLng) => {
    setInfoPopup({ 
      logId, 
      position: latLng, 
      title: data.status === 'pending' ? "Route Pending Dispatch" : "Mission Route", 
      desc: `Unit from: ${data.station.name}\nTarget: ${data.camera.name}`, 
      totalTime: data.etaText 
    });
    // Ez váltja át a bal oldali sávot a releváns kamera logjaira
    onCameraClick(data.camera);
  };

  const handleVehicleClick = (logId, data) => {
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
  };

  if (loadError) return <div style={{color: 'white', padding: '20px'}}>Error loading map.</div>;
  if (!isLoaded || !window.google) return <div style={{color: 'white', padding: '20px'}}>Loading map...</div>;

  return (
    <div className="map-container-wrapper">
      <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={MAP_CENTER} zoom={13} options={options}>
        <StationsLayer authorities={AUTHORITIES} routeData={routeData} onPinClick={setSelectedPin} />
        <CamerasLayer cameras={CAMERAS} logs={logs} routeData={routeData} onPinClick={setSelectedPin} onCameraClick={onCameraClick} />
        <MissionsLayer routeData={routeData} onLineClick={handleLineClick} onVehicleClick={handleVehicleClick} />
        <PopupLayer infoPopup={infoPopup} selectedPin={selectedPin} onCloseInfo={() => setInfoPopup(null)} onClosePin={() => setSelectedPin(null)} />
      </GoogleMap>
    </div>
  );
}