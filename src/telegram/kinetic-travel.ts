import { KineticTravelResult } from "./types";

/**
 * Centroid coordinates for common countries to enable kinetic distance
 * calculation even when raw GPS coordinates are not provided.
 */
const COUNTRY_CENTROIDS: Record<string, { lat: number; lon: number; name: string }> = {
  EG: { lat: 26.8206, lon: 30.8025, name: "Egypt" },
  SA: { lat: 23.8859, lon: 45.0792, name: "Saudi Arabia" },
  AE: { lat: 23.4241, lon: 53.8478, name: "United Arab Emirates" },
  US: { lat: 37.0902, lon: -95.7129, name: "United States" },
  GB: { lat: 55.3781, lon: -3.436, name: "United Kingdom" },
  DE: { lat: 51.1657, lon: 10.4515, name: "Germany" },
  FR: { lat: 46.2276, lon: 2.2137, name: "France" },
  CA: { lat: 56.1304, lon: -106.3468, name: "Canada" },
  AU: { lat: -25.2744, lon: 133.7751, name: "Australia" },
  NL: { lat: 52.1326, lon: 5.2913, name: "Netherlands" },
  TR: { lat: 38.9637, lon: 35.2433, name: "Turkey" },
  IN: { lat: 20.5937, lon: 78.9629, name: "India" },
  JP: { lat: 36.2048, lon: 138.2529, name: "Japan" },
  CN: { lat: 35.8617, lon: 104.1954, name: "China" },
  RU: { lat: 61.524, lon: 105.3188, name: "Russia" },
  BR: { lat: -14.235, lon: -51.9253, name: "Brazil" },
  SG: { lat: 1.3521, lon: 103.8198, name: "Singapore" },
  QA: { lat: 25.3548, lon: 51.1839, name: "Qatar" },
  KW: { lat: 29.3117, lon: 47.4818, name: "Kuwait" },
  JO: { lat: 30.5852, lon: 36.2384, name: "Jordan" },
  MA: { lat: 31.7917, lon: -7.0926, name: "Morocco" },
};

/**
 * Calculates Great-Circle distance between two points on Earth using Haversine formula
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export interface LocationPoint {
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timestamp?: Date | string | number;
}

/**
 * Kinetic Impossible Travel 2.0
 * Calculates speed required to transition between previous session and current session.
 */
export function calculateKineticTravel(
  previous: LocationPoint,
  current: LocationPoint
): KineticTravelResult | null {
  // Resolve coordinates
  const prevCoord = resolveCoordinates(previous);
  const currCoord = resolveCoordinates(current);

  if (!prevCoord || !currCoord) {
    return null;
  }

  // Calculate Great Circle Distance in Kilometers
  const distanceKm = haversineDistance(
    prevCoord.lat,
    prevCoord.lon,
    currCoord.lat,
    currCoord.lon
  );

  // If distance is negligible (< 25km), not impossible travel
  if (distanceKm < 25) {
    return null;
  }

  // Calculate Time Delta in Minutes
  const prevTime = previous.timestamp ? new Date(previous.timestamp).getTime() : Date.now() - 3600000;
  const currTime = current.timestamp ? new Date(current.timestamp).getTime() : Date.now();
  const diffMs = Math.max(currTime - prevTime, 1000); // minimum 1 second
  const timeDeltaMinutes = Math.max(Math.round(diffMs / (60 * 1000)), 1);

  // Calculate Required Speed in km/h
  const timeDeltaHours = diffMs / (3600 * 1000);
  const speedKmh = Math.round(distanceKm / timeDeltaHours);

  // Commercial airliner cruise speed is ~850-900 km/h
  // Supersonic or impossible if > 900 km/h
  const isImpossible = speedKmh > 900;

  const prevLocStr = [previous.city, previous.country].filter(Boolean).join(", ") || "Previous Location";
  const currLocStr = [current.city, current.country].filter(Boolean).join(", ") || "Current Location";

  let description: string;
  if (isImpossible) {
    description = `🚀 Impossible Travel: ${distanceKm.toLocaleString()} km in ${timeDeltaMinutes} mins (~${speedKmh.toLocaleString()} km/h). Faster than commercial airliner!`;
  } else if (speedKmh > 200 && timeDeltaMinutes < 120) {
    description = `⚡ High Speed Transition: ${distanceKm.toLocaleString()} km in ${timeDeltaMinutes} mins (~${speedKmh.toLocaleString()} km/h).`;
  } else {
    description = `📍 Normal Travel: ${distanceKm.toLocaleString()} km in ${timeDeltaMinutes} mins (~${speedKmh.toLocaleString()} km/h).`;
  }

  return {
    distanceKm,
    timeDeltaMinutes,
    speedKmh,
    isImpossible,
    previousLocation: prevLocStr,
    currentLocation: currLocStr,
    description,
  };
}

function resolveCoordinates(point: LocationPoint): { lat: number; lon: number } | null {
  if (typeof point.latitude === "number" && typeof point.longitude === "number") {
    return { lat: point.latitude, lon: point.longitude };
  }

  if (point.country) {
    const code = point.country.toUpperCase();
    if (COUNTRY_CENTROIDS[code]) {
      return { lat: COUNTRY_CENTROIDS[code].lat, lon: COUNTRY_CENTROIDS[code].lon };
    }
  }

  return null;
}
