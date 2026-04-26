export const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
];

export const ICONS = {
  police: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
  ambulance: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
  fire: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png",
  camera_normal: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
  camera_alert: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" 
};

export const getAuthorityType = (alertId) => {
  if (alertId === 'FIRE_EVENT') return 'fire';
  if (alertId === 'POSSIBLE_ATTACK') return 'police';
  if (alertId === 'HEALTH_EMERGENCY') return 'ambulance';
  return null;
};

export const getPointAlongPath = (path, progress) => {
  if (!path || path.length === 0) return null;
  if (progress <= 0) return path[0];
  if (progress >= 1) return path[path.length - 1];
  const exactIndex = progress * (path.length - 1);
  const lowerIndex = Math.floor(exactIndex);
  const upperIndex = Math.ceil(exactIndex);
  const fraction = exactIndex - lowerIndex;
  
  const p1 = path[lowerIndex];
  const p2 = path[upperIndex];
  return { lat: p1.lat + (p2.lat - p1.lat) * fraction, lng: p1.lng + (p2.lng - p1.lng) * fraction };
};

export const getVehicleIcon = (colorHex, isReturning) => ({
  path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, 
  scale: 6, 
  fillColor: colorHex, 
  fillOpacity: 1, 
  strokeWeight: 2, 
  strokeColor: '#ffffff', 
  rotation: isReturning ? 180 : 0
});