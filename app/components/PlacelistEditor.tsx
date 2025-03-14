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

// Used to track which item is being edited
interface EditingState {
  index: number;
  type: 'location' | 'spotify' | null;
  showMapPicker?: boolean;
  isGettingLocation?: boolean;
}

export default function PlacelistEditor({
  formAction,
  defaultValues,
  errors,
  isSubmitting,
  isEditing,
  cancelHref,
}: PlacelistEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const spotifyInputRef = useRef<HTMLInputElement>(null);
  
  // State for tabs
  const [activeTab, setActiveTab] = useState<'text' | 'preview'>('preview');
  
  // State for editing
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [showNewEntryForm, setShowNewEntryForm] = useState(false);
  const [newEntrySpotifyUrl, setNewEntrySpotifyUrl] = useState('');
  
  // Main data states
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

  // Function to update the text representation based on parsedItems
  const updateTextFromParsedItems = (items: PlacelistItem[]) => {
    const newText = items.map(item => 
      `${item.location?.lat || ''},${item.location?.lng || ''}\n${item.spotifyUrl || ''}`
    ).join('\n');
    
    setTextAreaValue(newText);
  };

  // Function to handle adding or updating a location from map selection
  const handleLocationSelect = (lat: number, lng: number) => {
    if (editingState) {
      // Update existing entry
      const updatedItems = [...parsedItems];
      updatedItems[editingState.index] = {
        ...updatedItems[editingState.index],
        location: { lat, lng }
      };
      
      setParsedItems(updatedItems);
      updateTextFromParsedItems(updatedItems);
      setEditingState(null);
    } else if (showNewEntryForm) {
      // Add location to new entry
      const newItem: PlacelistItem = {
        location: { lat, lng },
        spotifyUrl: newEntrySpotifyUrl,
        trackId: extractSpotifyTrackId(newEntrySpotifyUrl)
      };
      
      const updatedItems = [...parsedItems, newItem];
      setParsedItems(updatedItems);
      updateTextFromParsedItems(updatedItems);
      
      // Reset new entry form
      setShowNewEntryForm(false);
      setNewEntrySpotifyUrl('');
    }
  };

  // Function to get current location
  const getCurrentLocation = (callback: (lat: number, lng: number) => void) => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsGettingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        callback(latitude, longitude);
        setIsGettingLocation(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        alert(`Error getting location: ${error.message}`);
        setIsGettingLocation(false);
      },
      { 
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
  };

  // Function to add current location to an entry
  const addCurrentLocationToEntry = (index?: number) => {
    getCurrentLocation((lat, lng) => {
      if (index !== undefined) {
        // Update existing entry
        const updatedItems = [...parsedItems];
        updatedItems[index] = {
          ...updatedItems[index],
          location: { lat, lng }
        };
        
        setParsedItems(updatedItems);
        updateTextFromParsedItems(updatedItems);
        setEditingState(null);
      } else if (showNewEntryForm) {
        // Add to new entry
        const newItem: PlacelistItem = {
          location: { lat, lng },
          spotifyUrl: newEntrySpotifyUrl,
          trackId: extractSpotifyTrackId(newEntrySpotifyUrl)
        };
        
        const updatedItems = [...parsedItems, newItem];
        setParsedItems(updatedItems);
        updateTextFromParsedItems(updatedItems);
        
        // Reset new entry form
        setShowNewEntryForm(false);
        setNewEntrySpotifyUrl('');
      }
    });
  };

  // Function to start editing an entry
  const startEditingEntry = (index: number, type: 'location' | 'spotify') => {
    setEditingState({ index, type });
  };
  
  // Function to add new entry with only Spotify
  const addSpotifyOnlyEntry = () => {
    if (!newEntrySpotifyUrl) return;
    
    const newItem: PlacelistItem = {
      location: { lat: 0, lng: 0 },  // Placeholder
      spotifyUrl: newEntrySpotifyUrl,
      trackId: extractSpotifyTrackId(newEntrySpotifyUrl)
    };
    
    const updatedItems = [...parsedItems, newItem];
    setParsedItems(updatedItems);
    updateTextFromParsedItems(updatedItems);
    
    // Reset new entry form
    setShowNewEntryForm(false);
    setNewEntrySpotifyUrl('');
  };
  
  // Function to update Spotify URL for an entry
  const updateSpotifyUrl = (index: number, url: string) => {
    const updatedItems = [...parsedItems];
    updatedItems[index] = {
      ...updatedItems[index],
      spotifyUrl: url,
      trackId: extractSpotifyTrackId(url)
    };
    
    setParsedItems(updatedItems);
    updateTextFromParsedItems(updatedItems);
    setEditingState(null);
  };
  
  // Function to remove an entry
  const removeEntry = (index: number) => {
    const updatedItems = [...parsedItems];
    updatedItems.splice(index, 1);
    setParsedItems(updatedItems);
    updateTextFromParsedItems(updatedItems);
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

        {/* Tab navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`py-2 px-4 text-center border-b-2 font-medium text-sm ${
                activeTab === 'text'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Text Mode
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`py-2 px-4 text-center border-b-2 font-medium text-sm ${
                activeTab === 'preview'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Preview Mode
            </button>
          </nav>
        </div>

        {/* Hidden textarea for form submission */}
        <input 
          type="hidden" 
          name="placelistText" 
          value={textAreaValue} 
        />
        
        {/* Tab content */}
        <div className="mt-4">
          {/* Text Mode Tab Content */}
          {activeTab === 'text' && (
            <div>
              <div className="mb-2 text-sm text-gray-600">
                <p>Enter alternating lines of:</p>
                <ol className="list-decimal list-inside mt-1 ml-4 space-y-1">
                  <li>Latitude,Longitude (e.g., "37.7749,-122.4194")</li>
                  <li>Spotify link (e.g., "https://open.spotify.com/track/...")</li>
                </ol>
              </div>
              <textarea
                ref={textareaRef}
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
          )}
          
          {/* Preview Mode Tab Content */}
          {activeTab === 'preview' && (
            <div>
              {/* New Entry Form */}
              {showNewEntryForm ? (
                <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h3 className="text-lg font-medium mb-4">Add New Entry</h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">
                      Spotify Link
                    </label>
                    <input
                      type="text"
                      ref={spotifyInputRef}
                      value={newEntrySpotifyUrl}
                      onChange={(e) => setNewEntrySpotifyUrl(e.target.value)}
                      placeholder="https://open.spotify.com/track/..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Location</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingState({ 
                            index: -1, 
                            type: 'location',
                            showMapPicker: true
                          });
                        }}
                        className="text-sm bg-purple-500 hover:bg-purple-600 text-white font-medium py-1 px-3 rounded flex items-center"
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
                        Select on Map
                      </button>
                      <button
                        type="button"
                        onClick={() => addCurrentLocationToEntry()}
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
                            Use Current Location
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={addSpotifyOnlyEntry}
                        className="text-sm bg-green-500 hover:bg-green-600 text-white font-medium py-1 px-3 rounded flex items-center"
                      >
                        Add Spotify Only
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewEntryForm(false)}
                      className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-1 px-3 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowNewEntryForm(true)}
                    className="text-sm bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded flex items-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-1"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add New Entry
                  </button>
                </div>
              )}
              
              {/* Map Picker for editing entries */}
              {editingState?.showMapPicker && (
                <div className="mb-4 border border-gray-300 rounded-lg overflow-hidden">
                  <MapPicker onLocationSelect={handleLocationSelect} />
                  <div className="p-2 bg-gray-100 text-sm text-gray-600 flex justify-between items-center">
                    <span>Click anywhere on the map to select a location.</span>
                    <button
                      type="button"
                      onClick={() => setEditingState(null)}
                      className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-1 px-2 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              {/* Entries preview/editor */}
              {parsedItems.length > 0 ? (
                <div className="space-y-6">
                  {parsedItems.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                        <div className="flex items-center">
                          <span className="inline-block w-6 h-6 text-center bg-green-500 text-white rounded-full mr-2">
                            {index + 1}
                          </span>
                          <span className="text-sm font-mono">
                            {item.location.lat !== 0 || item.location.lng !== 0 ? 
                              `${item.location.lat.toFixed(6)}, ${item.location.lng.toFixed(6)}` :
                              <span className="text-gray-400 italic">No location set</span>
                            }
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingEntry(index, 'location')}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Edit Location
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditingEntry(index, 'spotify')}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Edit Track
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEntry(index)}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      
                      {/* Location editor */}
                      {editingState?.index === index && editingState?.type === 'location' && !editingState?.showMapPicker && (
                        <div className="p-3 bg-gray-100 border-b border-gray-200">
                          <p className="text-sm font-medium mb-2">Select location method:</p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingState({ ...editingState, showMapPicker: true })}
                              className="text-sm bg-purple-500 hover:bg-purple-600 text-white font-medium py-1 px-3 rounded flex items-center"
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
                              Select on Map
                            </button>
                            <button
                              type="button"
                              onClick={() => addCurrentLocationToEntry(index)}
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
                                  Use Current Location
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingState(null)}
                              className="text-sm bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-1 px-3 rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Spotify URL editor */}
                      {editingState?.index === index && editingState?.type === 'spotify' && (
                        <div className="p-3 bg-gray-100 border-b border-gray-200">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              defaultValue={item.spotifyUrl}
                              placeholder="https://open.spotify.com/track/..."
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                updateSpotifyUrl(index, input.value);
                              }}
                              className="text-sm bg-green-500 hover:bg-green-600 text-white font-medium py-1 px-2 rounded"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingState(null)}
                              className="text-sm bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-1 px-2 rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Map preview - only show if location is set */}
                      {(item.location.lat !== 0 || item.location.lng !== 0) && (
                        <div className="border-b border-gray-200">
                          <img 
                            src={getGoogleStaticMapUrl(item.location.lat, item.location.lng, 14, 400, 200)} 
                            alt={`Map location ${index + 1}`}
                            className="w-full h-32 object-cover"
                          />
                        </div>
                      )}
                      
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
                  <p>Add entries to see a preview</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4 mt-8">
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