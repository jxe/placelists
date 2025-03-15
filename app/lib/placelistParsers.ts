import { extractSpotifyTrackId } from "./utils";
import * as yaml from 'js-yaml';

export type PlacelistItem = {
  location: {
    lat: number;
    lng: number;
  };
  spotifyUrl: string;
  trackId?: string | null;
  onlyDuring?: string;
}

/**
 * Parse placelist text using legacy format (alternating lines of coordinates and Spotify URLs)
 */
export function parseTraditionalFormat(textContent: string): PlacelistItem[] {
  if (!textContent) {
    return [];
  }
  
  try {
    // Filter out empty lines and collect non-empty lines
    const filteredLines = textContent.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    const items: PlacelistItem[] = [];
    let currentLocation: { lat: number; lng: number } | null = null;
    
    // Process each non-empty line
    for (let i = 0; i < filteredLines.length; i++) {
      const line = filteredLines[i];
      
      // Check if line looks like a location (contains comma and numbers)
      if (line.includes(",") && /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(line)) {
        try {
          // Parse location
          const [lat, lng] = line.split(",").map(Number);
          if (!isNaN(lat) && !isNaN(lng)) {
            // Check if next line is a Spotify URL
            if (i + 1 < filteredLines.length) {
              const nextLine = filteredLines[i + 1];
              
              if (nextLine.includes("spotify.com") || nextLine.includes("spotify:track:")) {
                const trackId = extractSpotifyTrackId(nextLine);
                
                items.push({
                  location: { lat, lng },
                  spotifyUrl: nextLine,
                  trackId
                });
                
                // Skip the Spotify URL line in the next iteration
                i++;
              } else {
                // Store current location for potential matching with a later Spotify URL
                currentLocation = { lat, lng };
              }
            } else {
              // This is the last line and it's a location
              currentLocation = { lat, lng };
            }
          }
        } catch (err) {
          // Invalid location format
          continue;
        }
      } 
      // If line is a Spotify URL and we have a pending location
      else if (currentLocation && (line.includes("spotify.com") || line.includes("spotify:track:"))) {
        const trackId = extractSpotifyTrackId(line);
        
        items.push({
          location: currentLocation,
          spotifyUrl: line,
          trackId
        });
        
        // Reset the current location
        currentLocation = null;
      }
    }
    
    return items;
  } catch (err) {
    console.error("Error parsing placelist text in traditional format:", err);
    return [];
  }
}

/**
 * Parse placelist text using YAML format
 */
export function parseYamlFormat(textContent: string): PlacelistItem[] {
  if (!textContent) {
    return [];
  }
  
  try {
    // First try to parse the YAML content
    let parsed;
    try {
      parsed = yaml.load(textContent);
    } catch (yamlError: any) {
      // Provide more helpful error message for YAML parsing errors
      const errorMsg = yamlError.message || 'Unknown YAML parsing error';
      const lineInfo = yamlError.mark ? ` at line ${yamlError.mark.line + 1}` : '';
      throw new Error(`YAML parsing error${lineInfo}: ${errorMsg}`);
    }
    
    // Check if parsed result is an array
    if (!Array.isArray(parsed)) {
      throw new Error("YAML content is not an array. Make sure your YAML starts with '-' for each item.");
    }
    
    if (parsed.length === 0) {
      return [];
    }
    
    // Map and validate each item
    return parsed.map((item: any, index: number) => {
      // Validate item structure
      if (!item || typeof item !== 'object') {
        throw new Error(`Item at index ${index} is not an object. Each item should have location and spotifyUrl properties.`);
      }
      
      // Validate location
      if (!item.location || typeof item.location !== 'object') {
        throw new Error(`Location missing or invalid for item at index ${index}. Each item needs a location object with lat and lng properties.`);
      }
      
      // Validate coordinates
      const lat = Number(item.location.lat);
      const lng = Number(item.location.lng);
      
      if (isNaN(lat) || isNaN(lng)) {
        throw new Error(`Invalid coordinates for item at index ${index}. Latitude and longitude must be numbers.`);
      }
      
      // Validate Spotify URL
      if (!item.spotifyUrl || typeof item.spotifyUrl !== 'string') {
        throw new Error(`Spotify URL missing or invalid for item at index ${index}. Each item needs a spotifyUrl property.`);
      }
      
      // Check if onlyDuring field exists and is a string
      const onlyDuring = item.onlyDuring && typeof item.onlyDuring === 'string' 
        ? item.onlyDuring 
        : undefined;
        
      // Build the item with extracted track ID and optional onlyDuring field
      return {
        location: { lat, lng },
        spotifyUrl: item.spotifyUrl,
        trackId: extractSpotifyTrackId(item.spotifyUrl),
        ...(onlyDuring && { onlyDuring })
      };
    });
  } catch (err) {
    console.error("Error parsing placelist text as YAML:", err);
    throw err;
  }
}

/**
 * Parse placelist text with fallback (try YAML first, fall back to traditional format)
 */
export function parsePlacelistText(textContent: string): PlacelistItem[] {
  if (!textContent) {
    return [];
  }
  
  try {
    // Try to parse as YAML first
    return parseYamlFormat(textContent);
  } catch (err: any) {
    // Log error but don't expose to user
    console.log(`Couldn't parse as YAML (${err.message}), falling back to traditional format`);
    
    // Fall back to traditional parsing
    const items = parseTraditionalFormat(textContent);
    
    // If we parsed items successfully with the traditional parser, log that for debugging
    if (items.length > 0) {
      console.log(`Successfully parsed ${items.length} items using traditional format`);
    } else {
      console.log("Traditional parser also failed to find any valid items");
    }
    
    return items;
  }
}

/**
 * Format placelist items as YAML text
 */
export function formatAsYaml(items: PlacelistItem[]): string {
  // Transform items to ensure they have the right structure for YAML
  const yamlItems = items.map(item => {
    const yamlItem: Record<string, any> = {
      location: {
        lat: item.location.lat,
        lng: item.location.lng
      },
      spotifyUrl: item.spotifyUrl
    };
    
    // Add onlyDuring field if it exists
    if (item.onlyDuring) {
      yamlItem.onlyDuring = item.onlyDuring;
    }
    
    return yamlItem;
  });
  
  return yaml.dump(yamlItems);
}

/**
 * Format placelist items as traditional text (alternating lines)
 */
export function formatAsTraditional(items: PlacelistItem[]): string {
  return items.map(item => 
    `${item.location?.lat || ''},${item.location?.lng || ''}\n${item.spotifyUrl || ''}`
  ).join('\n');
}