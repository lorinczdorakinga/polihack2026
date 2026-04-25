import React, { useState, useMemo, useEffect } from 'react';
import { GoogleMap, useLoadScript, MarkerF, InfoWindowF, CircleF } from '@react-google-maps/api';
import { ALERT_TYPES, CAMERAS } from '../App'; 
import configData from '../resources/config.json'; // ÚJ: A JSON fájl beolvasása
import './Maps.css';

const GOOGLE_MAPS_API_KEY = "AIzaSyAKGpw5JBe1ZMrS6L2VYSahX29pvnYOKLs";

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

export default function Maps({ activeAlert, alertedCamera, onCameraClick }) {
  const [selectedPin, setSelectedPin] = useState(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const options = useMemo(() => ({
    styles: mapStyles,
    disableDefaultUI: true,
    zoomControl: true,
  }), []);

  useEffect(() => {
    if (activeAlert && alertedCamera) setSelectedPin(alertedCamera);
    else setSelectedPin(null);
  }, [activeAlert, alertedCamera]);

  if (loadError) return <div style={{color: 'white', padding: '20px'}}>Error loading map.</div>;
  if (!isLoaded) return <div style={{color: 'white', padding: '20px'}}>Loading map...</div>;

  return (
    <div className="map-container-wrapper">
      <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={mapCenter} zoom={13} options={options}>
        
        {/* Hatóságok (rendőr, mentő, tűzoltó) rajzolása */}
        {AUTHORITIES.map((station) => (
          <MarkerF
            key={station.id}
            position={{ lat: station.lat, lng: station.lng }}
            icon={{ url: ICONS[station.type], scaledSize: new window.google.maps.Size(35, 35) }}
            onClick={() => setSelectedPin(station)}
          />
        ))}

        {/* AZ ÖSSZES KAMERA RAJZOLÁSA CIKLUSSAL */}
        {CAMERAS.map((cam) => {
          // Ellenőrizzük, hogy ez a kamera riaszt-e éppen
          const isAlerting = activeAlert && alertedCamera && alertedCamera.id === cam.id;
          return (
            <MarkerF
              key={cam.id}
              position={{ lat: cam.lat, lng: cam.lng }}
              icon={{ 
                url: isAlerting ? ICONS.camera_alert : ICONS.camera_normal, 
                scaledSize: new window.google.maps.Size(45, 45) 
              }}
              onClick={() => {
                setSelectedPin(cam);
                onCameraClick(cam); // Ez váltja át a bal oldali sávot!
              }}
            />
          );
        })}

        {/* Színes kör (Halo), csak a riasztó kamera körül */}
        {activeAlert && alertedCamera && (
          <CircleF
            key={`halo_${activeAlert}`}
            center={{ lat: alertedCamera.lat, lng: alertedCamera.lng }}
            radius={300} 
            options={{
              fillColor: ALERT_TYPES[activeAlert].colorHex,
              fillOpacity: 0.3,
              strokeColor: ALERT_TYPES[activeAlert].colorHex,
              strokeOpacity: 0.9,
              strokeWeight: 2,
              clickable: false
            }}
          />
        )}

        {/* Információs buborék */}
        {selectedPin && (
          <InfoWindowF position={{ lat: selectedPin.lat, lng: selectedPin.lng }} onCloseClick={() => setSelectedPin(null)}>
            <div className="info-window">
              <h4>{selectedPin.name}</h4>
              <p>{selectedPin.address}</p>
              
              {/* Ha kamera, extra infók a riasztásról */}
              {selectedPin.id.startsWith('cam_') && (
                <div style={{ marginTop: '10px' }}>
                  {activeAlert && alertedCamera?.id === selectedPin.id ? (
                    <div className="alert-text">
                      <strong>DANGER ({ALERT_TYPES[activeAlert].labelText})</strong><br/>
                      {ALERT_TYPES[activeAlert].responderText}
                    </div>
                  ) : (
                    <p className="ok-text">Normal surveillance</p>
                  )}
                </div>
              )}
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  );
}