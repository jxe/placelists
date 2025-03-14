import { useState, useRef, useEffect } from "react";
import { Form, Link } from "react-router";
import { extractSpotifyTrackId } from "../lib/utils";
import { getGoogleStaticMapUrl } from "../lib/utils";
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

interface PlacelistEditorProps {
  formAction: string;
  defaultValues: {
    name: string;
    description: string;
    placelistText: string;
  };
  errors?: Record<string, string>;
  isSubmitting: boolean;
  isEditing: boolean;
  cancelHref?: string;
}

interface PlacelistItem {
  location: {
    lat: number;
    lng: number;
  };
  spotifyUrl: string;
  trackId?: string | null;
}

const MapPicker = ({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<google.maps.LatLngLiteral | null>(null);
  const [center, setCenter] = useState<google.maps.LatLngLiteral>({ lat: 37.7749, lng: -122.4194 });
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
  });

  // Try to get user's current location when component mounts
  useEffect(() => {
    if (navigator.geolocation) {
      setIsLoadingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCenter({ lat: latitude, lng: longitude });
          setIsLoadingLocation(false);
        },
        (error) => {
          console.error("Error getting location for map:", error);
          setIsLoadingLocation(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000
        }
      );
    } else {
      setIsLoadingLocation(false);
    }
  }, []);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarker({ lat, lng });
    onLocationSelect(lat, lng);
  };

  const mapContainerStyle = {
    width: '100%',
    height: '300px'
  };

  // Options to customize the map
  const mapOptions: google.maps.MapOptions = {
    streetViewControl: false,   // Disable Street View (pegman)
    mapTypeControl: false,      // Simplify the UI by removing the map type selector
    fullscreenControl: false,   // Remove fullscreen button for cleaner UI
    zoom: 16,                  // Tighter zoom (higher number = closer zoom)
    scrollwheel: true,          // Enable zoom with scroll wheel
    disableDefaultUI: false,    // Keep some UI elements
    zoomControl: true,          // Keep zoom controls
  };

  if (!isLoaded) return <div className="h-[300px] bg-gray-100 flex items-center justify-center">Loading Maps...</div>;
  
  if (isLoadingLocation) {
    return <div className="h-[300px] bg-gray-100 flex items-center justify-center">Getting your location...</div>;
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      options={mapOptions}
      onClick={handleMapClick}
      onLoad={map => setMap(map)}
    >
      {marker && <Marker position={marker} />}
    </GoogleMap>
  );
};

export default function PlacelistEditor({
  formAction,
  defaultValues,
  errors,
  isSubmitting,
  isEditing,
  cancelHref,
}: PlacelistEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [parsedItems, setParsedItems] = useState<PlacelistItem[]>([]);
  const [textAreaValue, setTextAreaValue] = useState(defaultValues.placelistText);

  // Parse the textarea content into structured items
  useEffect(() => {
    if (!textAreaValue) {
      setParsedItems([]);
      return;
    }
    
    try {
      // Filter out empty lines and collect non-empty lines
      const filteredLines = textAreaValue.split('\n')
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
      
      setParsedItems(items);
    } catch (err) {
      console.error("Error parsing placelist text:", err);
    }
  }, [textAreaValue]);

  // Function to add selected location from map to the textarea
  const addSelectedLocation = (lat: number, lng: number) => {
    const locationString = `${lat},${lng}\n`;
    
    if (textareaRef.current) {
      const textArea = textareaRef.current;
      const currentValue = textArea.value;
      
      // If there's already text, add a new line if needed
      const newValue = currentValue 
        ? (currentValue.endsWith('\n') ? currentValue : currentValue + '\n') + locationString
        : locationString;
        
      textArea.value = newValue;
      setTextAreaValue(newValue);
      
      // Set focus to textarea and position cursor at end
      textArea.focus();
      textArea.setSelectionRange(newValue.length, newValue.length);
    }
  };

  // Function to toggle the map picker
  const toggleMapPicker = () => {
    setShowMapPicker(!showMapPicker);
  };

  // Function to add current location to the textarea
  const addCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsGettingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locationString = `${latitude},${longitude}\n`;
        
        if (textareaRef.current) {
          const textArea = textareaRef.current;
          const currentValue = textArea.value;
          
          // If there's already text, add a new line if needed
          const newValue = currentValue 
            ? (currentValue.endsWith('\n') ? currentValue : currentValue + '\n') + locationString
            : locationString;
            
          textArea.value = newValue;
          setTextAreaValue(newValue);
          
          // Set focus to textarea and position cursor at end
          textArea.focus();
          textArea.setSelectionRange(newValue.length, newValue.length);
        }
        
        setIsGettingLocation(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        alert(`Error getting location: ${error.message}`);
        setIsGettingLocation(false);
      },
      { 
        enableHighAccuracy: true,
        maximumAge: 0, // Don't use cached positions
        timeout: 10000  // Wait up to 10 seconds for a new position
      }
    );
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      {isEditing && cancelHref && (
        <Link to={cancelHref} className="text-green-500 hover:underline mb-8 inline-block">
          ← Back to placelist
        </Link>
      )}
      
      <h1 className="text-3xl font-bold mb-8">
        {isEditing ? "Edit Placelist" : "Create New Placelist"}
      </h1>

      <Form action={formAction} method="post" className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            defaultValue={defaultValues.name}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
          />
          {errors?.name && (
            <p className="text-red-500 text-sm mt-1">{errors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-2">
            Description (Optional)
          </label>
          <textarea
            id="description"
            name="description"
            defaultValue={defaultValues.description}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 h-24"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="placelistText" className="block text-sm font-medium">
                Placelist Content
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={toggleMapPicker}
                  className={`text-sm ${showMapPicker ? 'bg-green-500 hover:bg-green-600' : 'bg-purple-500 hover:bg-purple-600'} text-white font-medium py-1 px-3 rounded flex items-center`}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4 mr-1" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {showMapPicker ? 'Hide Map Picker' : 'Use Map Picker'}
                </button>
                <button
                  type="button"
                  onClick={addCurrentLocation}
                  disabled={isGettingLocation}
                  className="text-sm bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded disabled:opacity-50 flex items-center"
                >
                  {isGettingLocation ? (
                    <span>Getting location...</span>
                  ) : (
                    <>
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 mr-1" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      Add Current Location
                    </>
                  )}
                </button>
              </div>
            </div>
            {showMapPicker && (
              <div className="mb-4 border border-gray-300 rounded-lg overflow-hidden">
                <MapPicker onLocationSelect={addSelectedLocation} />
                <div className="p-2 bg-gray-100 text-sm text-gray-600">
                  Click anywhere on the map to select a location. The coordinates will be added to your placelist.
                </div>
              </div>
            )}
            <div className="mb-2 text-sm text-gray-600">
              <p>Enter alternating lines of:</p>
              <ol className="list-decimal list-inside mt-1 ml-4 space-y-1">
                <li>Latitude,Longitude (e.g., "37.7749,-122.4194")</li>
                <li>Spotify link (e.g., "https://open.spotify.com/track/...")</li>
              </ol>
            </div>
            <textarea
              ref={textareaRef}
              id="placelistText"
              name="placelistText"
              value={textAreaValue}
              onChange={(e) => setTextAreaValue(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 h-72 font-mono"
              placeholder="37.7749,-122.4194
https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT
37.7833,-122.4167
https://open.spotify.com/track/0GswOA5NnzbGuC7WWjmCck"
            />
            {errors?.placelistText && (
              <p className="text-red-500 text-sm mt-1">{errors.placelistText}</p>
            )}
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Preview</h3>
            {parsedItems.length > 0 ? (
              <div className="space-y-6">
                {parsedItems.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center">
                      <span className="inline-block w-6 h-6 text-center bg-green-500 text-white rounded-full mr-2">
                        {index + 1}
                      </span>
                      <span className="text-sm font-mono">
                        {item.location.lat.toFixed(6)}, {item.location.lng.toFixed(6)}
                      </span>
                    </div>
                    
                    {/* Map preview */}
                    <div className="border-b border-gray-200">
                      <img 
                        src={getGoogleStaticMapUrl(item.location.lat, item.location.lng, 14, 400, 200)} 
                        alt={`Map location ${index + 1}`}
                        className="w-full h-32 object-cover"
                      />
                    </div>
                    
                    {/* Spotify preview */}
                    <div className="p-3">
                      {item.trackId ? (
                        <>
                          <div 
                            className="spotify-embed" 
                            dangerouslySetInnerHTML={{ 
                              __html: `<iframe 
                                style="border-radius:12px" 
                                src="https://open.spotify.com/embed/track/${item.trackId}" 
                                width="100%" 
                                height="80" 
                                frameBorder="0" 
                                allowfullscreen="" 
                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                                loading="lazy">
                              </iframe>` 
                            }} 
                          />
                          <div className="mt-2 text-xs text-gray-500">
                            <p>Track ID: {item.trackId}</p>
                            <p className="mt-1">Note: Full track info will be available with Spotify API credentials.</p>
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-gray-500 p-2 bg-gray-50 rounded">
                          Invalid Spotify URL
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 bg-gray-50 p-6 rounded-lg border border-gray-200 text-center">
                <p>Add location and Spotify entries to see a preview</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-4">
          {cancelHref && (
            <Link
              to={cancelHref}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-6 rounded-lg"
            >
              Cancel
            </Link>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-6 rounded-lg disabled:opacity-50"
          >
            {isSubmitting 
              ? (isEditing ? "Saving..." : "Creating...") 
              : (isEditing ? "Save Changes" : "Create Placelist")
            }
          </button>
        </div>
      </Form>
    </div>
  );
}