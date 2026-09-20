// Address -> coordinates using the U.S. Census Bureau geocoder: free, no API key, no
// usage terms that forbid storing the result (unlike most map providers).
// https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html

const ENDPOINT = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

// Logan Heights (Wikipedia). Results far from here are treated as a bad match, because the
// geocoder will happily place "Main St" in a different state if the address is mistyped.
export const NEIGHBORHOOD_CENTER = { lat: 32.6986, lng: -117.1294 };
export const MAX_DISTANCE_KM = 10;

export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * @returns {Promise<{lat:number,lng:number,matched:string}|null>}
 *   null when nothing matched, the match is implausibly far from the neighborhood, or the
 *   service is unreachable. Callers treat null as "leave the pin off the map for now".
 */
export async function geocodeAddress(address, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const url = `${ENDPOINT}?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match?.coordinates) return null;
    const point = { lat: Number(match.coordinates.y), lng: Number(match.coordinates.x) };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
    if (distanceKm(point, NEIGHBORHOOD_CENTER) > MAX_DISTANCE_KM) return null;
    return { ...point, matched: match.matchedAddress };
  } catch {
    return null;
  }
}

/** Geocode one business row and store the result. Returns true when coordinates were saved. */
export async function geocodeBusiness(db, business, options) {
  const found = await geocodeAddress(business.address, options);
  if (!found) return false;
  await db.query(
    'UPDATE businesses SET lat = $2, lng = $3, geocoded_at = now(), updated_at = now() WHERE id = $1',
    [business.id, found.lat, found.lng]
  );
  return true;
}
