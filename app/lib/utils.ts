import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Calculate distance between two coordinates in meters using Haversine formula
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Calculate bearing between two coordinates
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return ((θ * 180) / Math.PI + 360) % 360; // in degrees
}

// Parse placelist text format
export function parsePlacelistText(text: string): Array<{
  location: { lat: number; lng: number };
  spotifyUrl: string;
}> {
  const lines = text.trim().split("\n");
  const items = [];

  for (let i = 0; i < lines.length; i += 2) {
    if (i + 1 >= lines.length) break;

    const locationLine = lines[i].trim();
    const spotifyLine = lines[i + 1].trim();

    // Parse location - expects "lat,lng" format
    const [lat, lng] = locationLine.split(",").map(Number);
    
    if (isNaN(lat) || isNaN(lng)) {
      throw new Error(`Invalid location format at line ${i + 1}`);
    }

    // Validate Spotify URL
    if (!spotifyLine.includes("spotify.com") && !spotifyLine.includes("open.spotify.com")) {
      throw new Error(`Invalid Spotify URL at line ${i + 2}`);
    }

    items.push({
      location: { lat, lng },
      spotifyUrl: spotifyLine,
    });
  }

  return items;
}
