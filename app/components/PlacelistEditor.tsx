import { useState, useRef, useEffect } from "react";
import { Form, Link } from "react-router";
import { extractSpotifyTrackId } from "../lib/utils";
import { getGoogleStaticMapUrl } from "../lib/utils";
import { 
  parsePlacelistText, 
  formatAsYaml
} from "../lib/placelistParsers";
import type { PlacelistItem } from "../lib/placelistParsers";
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "./ui/dropdown-menu";
import { MapPin, Music, Trash2, MoreVertical, GripVertical, X } from "lucide-react";
import * as dndKitCore from '@dnd-kit/core';
const {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} = dndKitCore;
type DragEndEvent = dndKitCore.DragEndEvent;

import * as dndKitSortable from '@dnd-kit/sortable';
const {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} = dndKitSortable;

import * as dndKitUtilities from '@dnd-kit/utilities';
const { CSS } = dndKitUtilities;

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

// PlacelistItem interface is now imported from "../lib/placelistParsers"

// Used to track which item is being edited
interface EditingState {
  index: number;
  type: 'location' | 'spotify' | 'schedule' | null;
}

// Sortable item wrapper for drag and drop
function SortableItem({ children, id }: { children: React.ReactNode, id: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 1 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="absolute top-3 left-3 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
      {children}
    </div>
  );
}

// Google Maps picker component
const MapPicker = ({ 
  onLocationSelect, 
  onCancel
}: { 
  onLocationSelect: (lat: number, lng: number) => void;
  onCancel: () => void;
}) => {
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
    zoom: 14,                   // Less zoomed in for better context
    scrollwheel: true,          // Enable zoom with scroll wheel
    disableDefaultUI: false,    // Keep some UI elements
    zoomControl: true,          // Keep zoom controls
  };

  if (!isLoaded) return (
    <div className="relative">
      <div className="h-[300px] bg-gray-100 flex items-center justify-center">Loading Maps...</div>
      <button 
        onClick={onCancel}
        className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
        aria-label="Close map"
      >
        <X size={16} />
      </button>
    </div>
  );
  
  if (isLoadingLocation) {
    return (
      <div className="relative">
        <div className="h-[300px] bg-gray-100 flex items-center justify-center">Getting your location...</div>
        <button 
          onClick={onCancel}
          className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
          aria-label="Close map"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        options={mapOptions}
        onClick={handleMapClick}
        onLoad={map => setMap(map)}
      >
        {marker && <Marker position={marker} />}
      </GoogleMap>
      <button 
        onClick={onCancel}
        className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
        aria-label="Close map"
      >
        <X size={16} />
      </button>
      <div className="p-2 bg-gray-100 text-sm text-gray-600">
        <span>Click anywhere on the map to select a location</span>
      </div>
    </div>
  );
};

// Location editor component
const LocationEditor = ({
  isGettingLocation,
  onAddCurrentLocation,
  onCancel
}: {
  isGettingLocation: boolean;
  onAddCurrentLocation: () => void;
  onCancel: () => void;
}) => {
  const [showMap, setShowMap] = useState(false);
  
  if (showMap) {
    return (
      <MapPicker 
        onLocationSelect={(lat, lng) => {
          // We'll handle this in the parent
        }} 
        onCancel={() => setShowMap(false)} 
      />
    );
  }
  
  return (
    <div className="p-3 bg-gray-100 border-b border-gray-200">
      <p className="text-sm font-medium mb-2">Select location method:</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowMap(true)}
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
          onClick={onAddCurrentLocation}
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
          onClick={onCancel}
          className="text-sm bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-1 px-3 rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// PlacelistEntry component for a single entry
const PlacelistEntry = ({
  item,
  index,
  editingState,
  isGettingLocation,
  onEdit,
  onRemove,
  onLocationSelect,
  onAddCurrentLocation,
  onCancelEdit,
  onUpdateSpotify,
  onUpdateSchedule
}: {
  item: PlacelistItem;
  index: number;
  editingState: EditingState | null;
  isGettingLocation: boolean;
  onEdit: (index: number, type: 'location' | 'spotify' | 'schedule') => void;
  onRemove: (index: number) => void;
  onLocationSelect: (index: number, lat: number, lng: number) => void;
  onAddCurrentLocation: (index: number) => void;
  onCancelEdit: () => void;
  onUpdateSpotify: (index: number, url: string) => void;
  onUpdateSchedule: (index: number, schedule: string | undefined) => void;
}) => {
  const [showMap, setShowMap] = useState(false);
  
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white pl-7">
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
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-200 focus-visible:outline-none">
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(index, 'location')}>
              <MapPin className="mr-2 h-4 w-4 text-blue-600" />
              <span>Edit Location</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(index, 'spotify')}>
              <Music className="mr-2 h-4 w-4 text-blue-600" />
              <span>Edit Track</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(index, 'schedule')}>
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Set Opening Hours</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onRemove(index)}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Remove</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Location editor */}
      {editingState?.index === index && editingState?.type === 'location' && (
        showMap ? (
          <MapPicker 
            onLocationSelect={(lat, lng) => {
              onLocationSelect(index, lat, lng);
              setShowMap(false);
            }} 
            onCancel={() => setShowMap(false)} 
          />
        ) : (
          <div className="p-3 bg-gray-100 border-b border-gray-200">
            <p className="text-sm font-medium mb-2">Select location method:</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowMap(true)}
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
                onClick={() => onAddCurrentLocation(index)}
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
                onClick={onCancelEdit}
                className="text-sm bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-1 px-3 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )
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
                onUpdateSpotify(index, input.value);
              }}
              className="text-sm bg-green-500 hover:bg-green-600 text-white font-medium py-1 px-2 rounded"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-sm bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-1 px-2 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Schedule editor */}
      {editingState?.index === index && editingState?.type === 'schedule' && (
        <div className="p-3 bg-gray-100 border-b border-gray-200">
          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">
              Opening Hours (optional)
            </label>
            <input
              type="text"
              defaultValue={item.onlyDuring || ''}
              placeholder="e.g., 9-5 (MO-FR); 10-3 (SA-SU) PST"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
            />
          </div>
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mb-2">
            <p className="font-semibold mb-1">Format:</p>
            <code>time-range (days) timezone</code>
            <ul className="list-disc list-inside mt-1 ml-2 space-y-1">
              <li>Time: 9-5, 10:30-18:00, 11am-8pm, 9-18:30</li>
              <li>Days: MO, TU, WE, TH, FR, SA, SU (can use ranges like MO-FR)</li>
              <li>Multiple ranges: separate with semicolons, e.g., 9-5 (MO-FR); 10-3 (SA-SU)</li>
              <li>Timezone: optional 3-4 letter code, e.g., EST, PST, UTC</li>
            </ul>
            <p className="mt-1">Example: 9am-5:30pm (MO-FR); 11-3 (SA) EST</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                const input = e.currentTarget.parentElement?.previousElementSibling?.previousElementSibling?.querySelector('input') as HTMLInputElement;
                const schedule = input.value.trim();
                onUpdateSchedule(index, schedule || undefined);
              }}
              className="text-sm bg-green-500 hover:bg-green-600 text-white font-medium py-1 px-2 rounded"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
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
            src={getGoogleStaticMapUrl(item.location.lat, item.location.lng, 14, 600, 300)} 
            alt={`Map location ${index + 1}`}
            className="w-full h-40 object-cover"
          />
          {item.onlyDuring && (
            <div className="bg-blue-50 p-2 text-sm border-t border-blue-100">
              <span className="font-medium text-blue-800">Opening hours: </span>
              <span className="text-blue-700">{item.onlyDuring}</span>
            </div>
          )}
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
  );
};

// New Entry Form Component
const NewEntryForm = ({
  spotifyInputRef,
  newEntrySpotifyUrl,
  isGettingLocation,
  onSpotifyChange,
  onLocationSelect,
  onCurrentLocation,
  onAddSpotifyOnly,
  onCancel
}: {
  spotifyInputRef: React.RefObject<HTMLInputElement | null>;
  newEntrySpotifyUrl: string;
  isGettingLocation: boolean;
  onSpotifyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLocationSelect: (lat: number, lng: number) => void;
  onCurrentLocation: () => void;
  onAddSpotifyOnly: () => void;
  onCancel: () => void;
}) => {
  const [showMap, setShowMap] = useState(false);

  return (
    <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 className="text-lg font-medium mb-4">Add New Entry</h3>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Spotify Link
        </label>
        <input
          type="text"
          ref={spotifyInputRef}
          value={newEntrySpotifyUrl}
          onChange={onSpotifyChange}
          placeholder="https://open.spotify.com/track/..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
        />
      </div>
      
      {/* Show map or location selection buttons */}
      {showMap ? (
        <div className="mb-4">
          <MapPicker 
            onLocationSelect={(lat, lng) => {
              onLocationSelect(lat, lng);
              setShowMap(false);
            }}
            onCancel={() => setShowMap(false)} 
          />
        </div>
      ) : (
        <div className="mb-4">
          <p className="text-sm font-medium mb-2">Location</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowMap(true)}
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
              onClick={onCurrentLocation}
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
              onClick={onAddSpotifyOnly}
              className="text-sm bg-green-500 hover:bg-green-600 text-white font-medium py-1 px-3 rounded flex items-center"
            >
              Add Spotify Only
            </button>
          </div>
        </div>
      )}
      
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-1 px-3 rounded"
        >
          Cancel
        </button>
      </div>
    </div>
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

  // Parse the textarea content into structured items using the parser with fallback
  useEffect(() => {
    if (!textAreaValue) {
      setParsedItems([]);
      return;
    }
    
    try {
      // Use the parser with fallback (YAML first, then traditional format)
      const items = parsePlacelistText(textAreaValue);
      setParsedItems(items);
    } catch (err) {
      console.error("Error parsing placelist text:", err);
    }
  }, [textAreaValue]);

  // Function to update the text representation based on parsedItems
  const updateTextFromParsedItems = (items: PlacelistItem[]) => {
    // Format items as YAML
    const newText = formatAsYaml(items);
    setTextAreaValue(newText);
  };

  // Function to handle adding or updating a location from map selection for a specific entry
  const handleEntryLocationSelect = (index: number, lat: number, lng: number) => {
    // Update existing entry
    const updatedItems = [...parsedItems];
    updatedItems[index] = {
      ...updatedItems[index],
      location: { lat, lng }
    };
    
    setParsedItems(updatedItems);
    updateTextFromParsedItems(updatedItems);
    setEditingState(null);
  };

  // Function to handle adding location for a new entry
  const handleNewEntryLocationSelect = (lat: number, lng: number) => {
    // Add location to new entry
    const newItem: PlacelistItem = {
      location: { lat, lng },
      spotifyUrl: newEntrySpotifyUrl,
      trackId: extractSpotifyTrackId(newEntrySpotifyUrl)
    };
    
    const updatedItems = [...parsedItems, newItem];
    setParsedItems(updatedItems);
    updateTextFromParsedItems(updatedItems);
    
    // Reset form state
    setShowNewEntryForm(false);
    setNewEntrySpotifyUrl('');
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
  const addCurrentLocationToEntry = (index: number) => {
    getCurrentLocation((lat, lng) => {
      // Update existing entry
      const updatedItems = [...parsedItems];
      updatedItems[index] = {
        ...updatedItems[index],
        location: { lat, lng }
      };
      
      setParsedItems(updatedItems);
      updateTextFromParsedItems(updatedItems);
      setEditingState(null);
    });
  };

  // Function to add current location to new entry
  const addCurrentLocationToNewEntry = () => {
    getCurrentLocation((lat, lng) => {
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
  
  // Function to update schedule for an entry
  const updateSchedule = (index: number, schedule: string | undefined) => {
    const updatedItems = [...parsedItems];
    if (schedule) {
      updatedItems[index] = {
        ...updatedItems[index],
        onlyDuring: schedule
      };
    } else {
      // Remove the onlyDuring property if no schedule
      const { onlyDuring, ...rest } = updatedItems[index];
      updatedItems[index] = rest;
    }
    
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
  
  // Handle drag end event for reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = parseInt(active.id as string);
      const newIndex = parseInt(over.id as string);
      
      const newItems = arrayMove(parsedItems, oldIndex, newIndex);
      setParsedItems(newItems);
      updateTextFromParsedItems(newItems);
    }
  };
  
  // Configure DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Only start dragging after moving 5px to avoid accidental drags
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      {isEditing && cancelHref && (
        <Link to={cancelHref} className="text-green-500 hover:underline mb-8 inline-block">
          ← Back to placelist
        </Link>
      )}
      
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">
          {isEditing ? "Edit Placelist" : "Create New Placelist"}
        </h1>
        <div className="flex gap-4 mt-4 sm:mt-0">
          {cancelHref && (
            <Link
              to={cancelHref}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-6 rounded-lg"
            >
              Cancel
            </Link>
          )}
          <button
            form="placelistForm"
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
      </div>

      <Form id="placelistForm" action={formAction} method="post" className="space-y-6">
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
                <p>Enter placelist data in YAML format:</p>
                <pre className="mt-1 ml-4 p-2 bg-gray-100 rounded text-xs">
- location:
    lat: 37.7749
    lng: -122.4194
  spotifyUrl: https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT
  onlyDuring: 9am-5pm (MO-FR) PST
- location:
    lat: 37.7833
    lng: -122.4167
  spotifyUrl: https://open.spotify.com/track/0GswOA5NnzbGuC7WWjmCck
                </pre>
                <p className="mt-2">Or use the legacy format of alternating lines:</p>
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
                placeholder="- location:
    lat: 37.7749
    lng: -122.4194
  spotifyUrl: https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT
  onlyDuring: 9am-5pm (MO-FR) PST
- location:
    lat: 37.7833
    lng: -122.4167
  spotifyUrl: https://open.spotify.com/track/0GswOA5NnzbGuC7WWjmCck"
              />
              {errors?.placelistText && (
                <p className="text-red-500 text-sm mt-1">{errors.placelistText}</p>
              )}
            </div>
          )}
          
          {/* Preview Mode Tab Content */}
          {activeTab === 'preview' && (
            <div>
              {/* Placelist entries */}
              {parsedItems.length > 0 ? (
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext 
                    items={parsedItems.map((_, index) => index.toString())} 
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-6">
                      {parsedItems.map((item, index) => (
                        <SortableItem key={index} id={index.toString()}>
                          <PlacelistEntry
                            item={item}
                            index={index}
                            editingState={editingState}
                            isGettingLocation={isGettingLocation}
                            onEdit={startEditingEntry}
                            onRemove={removeEntry}
                            onLocationSelect={handleEntryLocationSelect}
                            onAddCurrentLocation={addCurrentLocationToEntry}
                            onCancelEdit={() => setEditingState(null)}
                            onUpdateSpotify={updateSpotifyUrl}
                            onUpdateSchedule={updateSchedule}
                          />
                        </SortableItem>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="text-gray-500 bg-gray-50 p-6 rounded-lg border border-gray-200 text-center">
                  <p>Add entries to see a preview</p>
                </div>
              )}
              
              {/* New entry form at the bottom */}
              {showNewEntryForm ? (
                <NewEntryForm
                  spotifyInputRef={spotifyInputRef}
                  newEntrySpotifyUrl={newEntrySpotifyUrl}
                  isGettingLocation={isGettingLocation}
                  onSpotifyChange={(e) => setNewEntrySpotifyUrl(e.target.value)}
                  onLocationSelect={handleNewEntryLocationSelect}
                  onCurrentLocation={addCurrentLocationToNewEntry}
                  onAddSpotifyOnly={addSpotifyOnlyEntry}
                  onCancel={() => setShowNewEntryForm(false)}
                />
              ) : (
                <div className="mt-6 flex justify-center">
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
            </div>
          )}
        </div>
      </Form>
    </div>
  );
}