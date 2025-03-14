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

// Convert heading in degrees to a compass direction
export function getCompassDirection(degrees: number): string {
  // Define direction ranges
  const directions = [
    { label: "N", min: 348.75, max: 360 },
    { label: "N", min: 0, max: 11.25 },
    { label: "NNE", min: 11.25, max: 33.75 },
    { label: "NE", min: 33.75, max: 56.25 },
    { label: "ENE", min: 56.25, max: 78.75 },
    { label: "E", min: 78.75, max: 101.25 },
    { label: "ESE", min: 101.25, max: 123.75 },
    { label: "SE", min: 123.75, max: 146.25 },
    { label: "SSE", min: 146.25, max: 168.75 },
    { label: "S", min: 168.75, max: 191.25 },
    { label: "SSW", min: 191.25, max: 213.75 },
    { label: "SW", min: 213.75, max: 236.25 },
    { label: "WSW", min: 236.25, max: 258.75 },
    { label: "W", min: 258.75, max: 281.25 },
    { label: "WNW", min: 281.25, max: 303.75 },
    { label: "NW", min: 303.75, max: 326.25 },
    { label: "NNW", min: 326.25, max: 348.75 }
  ];

  // Handle special case for North spanning 348.75-360 and 0-11.25
  if (degrees >= 348.75 || degrees < 11.25) {
    return "N";
  }

  // Find the matching direction
  for (const dir of directions) {
    if (degrees >= dir.min && degrees < dir.max) {
      return dir.label;
    }
  }

  return "N"; // Default fallback
}

/**
 * Extracts Spotify track ID from a Spotify URL
 */
export function extractSpotifyTrackId(spotifyUrl: string): string | null {
  // Handle both formats: https://open.spotify.com/track/ID and spotify:track:ID
  if (spotifyUrl.includes('spotify.com/track/')) {
    const match = spotifyUrl.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  } else if (spotifyUrl.includes('spotify:track:')) {
    const match = spotifyUrl.match(/spotify:track:([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }
  return null;
}

/**
 * Generates a Google Static Maps URL for a given location
 */
export function getGoogleStaticMapUrl(lat: number, lng: number, zoom: number = 14, width: number = 600, height: number = 300): string {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (apiKey) {
    // If API key is available, use the Google Maps API
    // Added scale=2 for higher resolution images
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&scale=2&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
  } else {
    // Fallback to placeholder if no API key is provided
    return `https://placehold.co/${width}x${height}?text=Map+Location:+${lat.toFixed(4)},${lng.toFixed(4)}`;
  }
}

// Parse placelist text format
export function parsePlacelistText(text: string): Array<{
  location: { lat: number; lng: number };
  spotifyUrl: string;
}> {
  // First, filter out empty lines to handle user-added blank lines
  const filteredLines = text.split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  const items = [];
  let currentLocation: string | null = null;

  // Process each non-empty line
  for (let i = 0; i < filteredLines.length; i++) {
    const line = filteredLines[i];
    
    // Check if line looks like a location (contains comma and numbers)
    if (line.includes(",") && /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(line)) {
      // If we have a location and the next line is a Spotify URL, create an item
      if (i + 1 < filteredLines.length) {
        const nextLine = filteredLines[i + 1];
        
        // Check if next line is a Spotify URL
        if (nextLine.includes("spotify.com") || nextLine.includes("spotify:track:")) {
          // Parse location
          const [lat, lng] = line.split(",").map(Number);
          
          // Add item
          items.push({
            location: { lat, lng },
            spotifyUrl: nextLine,
          });
          
          // Skip the Spotify URL line in the next iteration
          i++;
        } else {
          // Store current location for potential matching with later Spotify URL
          currentLocation = line;
        }
      }
    } 
    // If line is a Spotify URL and we have a pending location
    else if (currentLocation && (line.includes("spotify.com") || line.includes("spotify:track:"))) {
      // Parse location
      const [lat, lng] = currentLocation.split(",").map(Number);
      
      // Add item
      items.push({
        location: { lat, lng },
        spotifyUrl: line,
      });
      
      // Reset the current location
      currentLocation = null;
    }
  }

  // Validate we have at least one item
  if (items.length === 0 && filteredLines.length > 0) {
    throw new Error("No valid location-song pairs found. Please check your format.");
  }

  return items;
}
