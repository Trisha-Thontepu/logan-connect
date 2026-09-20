import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom marker so pins match the site's palette instead of Leaflet's default blue teardrop.
function pinIcon(color) {
  const svg = `
    <svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.9 15 38 15 38s15-12.1 15-23.2C30 6.6 23.3 0 15 0z" fill="${color}" stroke="#1B1330" stroke-width="1.5"/>
      <circle cx="15" cy="14.5" r="5.5" fill="#1B1330"/>
    </svg>`;
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
  });
}

const COLORS = ['#F2A93C', '#E8467F', '#2FB8A6'];

export default function MapView({ businesses }) {
  // Listings are geocoded from their address (npm run db:geocode) and can exist before
  // that has run, or if a lookup failed. Leaflet throws on null coordinates, so only
  // pin the ones that have them.
  const located = businesses.filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng));
  if (!located.length) return null;
  const center = [located[0].lat, located[0].lng];

  return (
    <MapContainer
      center={center}
      zoom={15}
      scrollWheelZoom={false}
      style={{ height: '420px', width: '100%', borderRadius: '18px' }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {located.map((b, i) => (
        <Marker key={b.id} position={[b.lat, b.lng]} icon={pinIcon(COLORS[i % COLORS.length])}>
          <Popup>
            <strong>{b.name}</strong>
            <br />
            {b.category}
            <br />
            <Link to={`/negocio/${b.slug}`}>View profile →</Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
