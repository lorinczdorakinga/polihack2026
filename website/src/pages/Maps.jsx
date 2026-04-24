import React, { useState, useMemo, useEffect } from 'react';
import { GoogleMap, useLoadScript, MarkerF, InfoWindowF, CircleF } from '@react-google-maps/api';
import { ALERT_TYPES } from '../App'; // Beimportáljuk a színeket és szövegeket
import './Maps.css';

const GOOGLE_MAPS_API_KEY = "AIzaSyAKGpw5JBe1ZMrS6L2VYSahX29pvnYOKLs";

const AUTHORITIES = [
  { id: 'pol_1', type: 'police', name: 'Poliția Municipiului', lat: 46.7758, lng: 23.5855, address: 'Str. Decebal 26' },
  { id: 'pol_2', type: 'police', name: 'Secția 1 Poliție', lat: 46.7664, lng: 23.5815, address: 'Str. Clinicilor' },
  { id: 'pol_3', type: 'police', name: 'Secția 2 Poliție', lat: 46.7709, lng: 23.6190, address: 'Str. Albac 15' },
  { id: 'pol_4', type: 'police', name: 'Secția 3 Poliție', lat: 46.7645, lng: 23.6058, address: 'Str. Septimiu Albini' },
  { id: 'amb_1', type: 'ambulance', name: 'Ambulanța Cluj', lat: 46.7785, lng: 23.5866, address: 'Str. Horea 40' },
  { id: 'amb_2', type: 'ambulance', name: 'UPU SMURD', lat: 46.7669, lng: 23.5828, address: 'Str. Clinicilor 3-5' },
  { id: 'fire_1', type: 'fire department', name: 'ISU Cluj', lat: 46.7735, lng: 23.6015, address: 'B-dul 21 Decembrie 1989' },
  { id: 'fire_2', type: 'fire department', name: 'Detașamentul 2 Pompieri', lat: 46.7544, lng: 23.5558, address: 'Mănăștur / Colina' }
];

const CAMERA_STATION = { id: 'cam_1', name: 'Smart_Camera_1', lat: 46.7825, lng: 23.6051, address: 'Str. Henri Barbusse 44' };
const mapCenter = { lat: 46.7700, lng: 23.5900 };

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

// A Maps mostantól megkapja propként az activeAlert-et az App.jsx-ből!
export default function Maps({ activeAlert }) {
  const [selectedPin, setSelectedPin] = useState(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const options = useMemo(() => ({
    styles: mapStyles,
    disableDefaultUI: true,
    zoomControl: true,
  }), []);

  // Ez a React varázslat magától megnyitja/bezárja a buborékot, ha jön a riasztásjel az App-tól
  useEffect(() => {
    if (activeAlert) setSelectedPin(CAMERA_STATION);
    else setSelectedPin(null);
  }, [activeAlert]);

  if (loadError) return <div style={{color: 'white', padding: '20px'}}>Error loading map.</div>;
  if (!isLoaded) return <div style={{color: 'white', padding: '20px'}}>Loading map...</div>;

  return (
    <div className="map-container-wrapper">
      <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={mapCenter} zoom={13} options={options}>
        
        {AUTHORITIES.map((station) => (
          <MarkerF
            key={station.id}
            position={{ lat: station.lat, lng: station.lng }}
            icon={{ url: ICONS[station.type], scaledSize: new window.google.maps.Size(35, 35) }}
            onClick={() => setSelectedPin(station)}
          />
        ))}

        <MarkerF
          position={{ lat: CAMERA_STATION.lat, lng: CAMERA_STATION.lng }}
          icon={{ url: activeAlert ? ICONS.camera_alert : ICONS.camera_normal, scaledSize: new window.google.maps.Size(45, 45) }}
          onClick={() => setSelectedPin(CAMERA_STATION)}
        />

        {activeAlert && (
          <CircleF
            key={`halo_${activeAlert}`}
            center={{ lat: CAMERA_STATION.lat, lng: CAMERA_STATION.lng }}
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

        {selectedPin && (
          <InfoWindowF position={{ lat: selectedPin.lat, lng: selectedPin.lng }} onCloseClick={() => setSelectedPin(null)}>
            <div className="info-window">
              <h4>{selectedPin.name}</h4>
              <p>{selectedPin.address}</p>
              
              {selectedPin.id === 'cam_1' && (
                <div style={{ marginTop: '10px' }}>
                  {activeAlert ? (
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