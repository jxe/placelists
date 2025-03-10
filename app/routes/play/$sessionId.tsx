import { useLoaderData, useFetcher } from "react-router";
import { useEffect, useState, useRef } from "react";
import type { Route } from "./+types/$sessionId";
import { getSession, updateSessionProgress } from "../../lib/db";
import { calculateDistance, calculateBearing, getCompassDirection } from "../../lib/utils";

export async function loader({ params }: Route.LoaderArgs) {
  const session = await getSession(params.sessionId as string);
  
  if (!session) {
    throw new Response("Not Found", { status: 404 });
  }
  
  return { session };
}

export async function action({ params, request }: Route.ActionArgs) {
  const session = await getSession(params.sessionId as string);
  
  if (!session) {
    throw new Response("Not Found", { status: 404 });
  }
  
  const formData = await request.formData();
  const progress = Number(formData.get("progress"));
  
  if (isNaN(progress)) {
    return { error: "Invalid progress value", status: 400 };
  }
  
  // Only allow increasing progress (unlocking new songs)
  if (progress > session.progress) {
    await updateSessionProgress(session.id, progress);
  }
  
  return { success: true };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data?.session) {
    return [{ title: "Session Not Found - SpotiSpot" }];
  }
  
  return [
    { title: `Playing ${data.session.placelist.name} - SpotiSpot` },
  ];
}

interface GeoPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

export default function Player() {
  const { session } = useLoaderData<typeof loader>();
  const placelist = session.placelist;
  const items = placelist.items as Array<{ location: { lat: number; lng: number }; spotifyUrl: string }>;
  
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<number>(session.progress);
  const [distance, setDistance] = useState<number | null>(null);
  const [bearing, setBearing] = useState<number | null>(null);
  const [watching, setWatching] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [deviceOrientation, setDeviceOrientation] = useState<number | null>(null);
  const [compassDirection, setCompassDirection] = useState<string>("N");
  
  const watchId = useRef<number | null>(null);
  const fetcher = useFetcher();
  
  // Complete state
  const isComplete = currentItem >= items.length;
  
  // Request device orientation permission (for iOS)
  async function requestOrientationPermission() {
    // Check if DeviceOrientationEvent exists and has the requestPermission method (iOS 13+)
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        // Request permission
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === 'granted') {
          return true;
        } else {
          console.warn("Device orientation permission denied");
          return false;
        }
      } catch (error) {
        console.error("Error requesting device orientation permission:", error);
        return false;
      }
    } else {
      // No permission needed for non-iOS or older iOS
      return true;
    }
  }

  // Start watching geolocation and device orientation
  async function startWatching() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    
    setWatching(true);
    
    // Start watching device orientation
    if (window.DeviceOrientationEvent) {
      // Request permission first (for iOS)
      const permissionGranted = await requestOrientationPermission();
      
      if (permissionGranted) {
        const handleOrientation = (event: DeviceOrientationEvent) => {
          // For iOS devices - alpha is relative to magnetic north
          if (event.webkitCompassHeading !== undefined) {
            const heading = event.webkitCompassHeading;
            setDeviceOrientation(heading);
            setCompassDirection(getCompassDirection(heading));
          } 
          // For Android devices - alpha is relative to arbitrary direction
          else if (event.alpha !== null) {
            const heading = 360 - event.alpha; // Convert to clockwise rotation
            setDeviceOrientation(heading);
            setCompassDirection(getCompassDirection(heading));
          }
        };
        
        // Store reference to the handler for cleanup
        orientationHandlerRef.current = handleOrientation;
        
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    } else {
      console.warn("Device orientation not supported by this browser");
    }
    
    // Start watching geolocation
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setPosition(position);
        setError(null);
        
        if (currentItem < items.length) {
          const target = items[currentItem].location;
          const dist = calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            target.lat,
            target.lng
          );
          setDistance(dist);
          
          const bear = calculateBearing(
            position.coords.latitude,
            position.coords.longitude,
            target.lat,
            target.lng
          );
          setBearing(bear);
          
          // Auto unlock if within 25 meters
          if (dist <= 25 && !unlocking) {
            unlockNext();
          }
        }
      },
      (err) => {
        console.error(err);
        setError(`Error getting location: ${err.message}`);
        setWatching(false);
      },
      { 
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );
  }
  
  // Reference to orientation event handler
  const orientationHandlerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null);
  
  // Stop watching geolocation and device orientation
  function stopWatching() {
    // Clear geolocation watch
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    
    // Remove device orientation event listener
    if (orientationHandlerRef.current) {
      window.removeEventListener('deviceorientation', orientationHandlerRef.current, true);
      orientationHandlerRef.current = null;
    }
    
    setWatching(false);
  }
  
  // Unlock the next item when the user is at the right location
  function unlockNext() {
    if (currentItem < items.length && !unlocking) {
      setUnlocking(true);
      
      fetcher.submit(
        { progress: currentItem + 1 },
        { method: "post" }
      );
      
      // Optimistically update the UI
      setCurrentItem(currentItem + 1);
      
      // Reset state for next location if there is one
      if (currentItem + 1 < items.length) {
        setDistance(null);
        setBearing(null);
      }
    }
  }
  
  // Clean up the geolocation watcher and device orientation listener when the component unmounts
  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      
      if (orientationHandlerRef.current) {
        window.removeEventListener('deviceorientation', orientationHandlerRef.current, true);
      }
    };
  }, []);
  
  // Reset unlocking state when the fetcher is done
  useEffect(() => {
    if (fetcher.state === "idle" && unlocking) {
      setUnlocking(false);
    }
  }, [fetcher.state, unlocking]);
  
  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <h1 className="text-2xl font-bold mb-2">{placelist.name}</h1>
      {placelist.description && (
        <p className="text-gray-700 mb-6">{placelist.description}</p>
      )}
      
      {isComplete ? (
        <div className="text-center py-8 bg-green-50 rounded-lg border border-green-200 mb-8">
          <h2 className="text-xl font-bold mb-4">Placelist Complete!</h2>
          <p className="mb-4">You've visited all the locations and unlocked all the songs.</p>
          <div className="space-y-4">
            <h3 className="font-semibold">Your Soundtrack</h3>
            <ul className="space-y-3">
              {items.map((item, index) => (
                <li key={index} className="flex items-center p-3 bg-white rounded border border-gray-200">
                  <span className="inline-block w-6 h-6 text-center bg-green-500 text-white rounded-full mr-2">
                    {index + 1}
                  </span>
                  <a 
                    href={item.spotifyUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-green-500 hover:underline"
                  >
                    {item.spotifyUrl.substring(0, 40)}...
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                Location {currentItem + 1} of {items.length}
              </h2>
              {!watching ? (
                <button
                  onClick={startWatching}
                  className="bg-green-500 hover:bg-green-600 text-white text-sm font-medium py-1 px-3 rounded"
                >
                  Start Compass
                </button>
              ) : (
                <button
                  onClick={stopWatching}
                  className="bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium py-1 px-3 rounded"
                >
                  Stop Compass
                </button>
              )}
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">
                {error}
              </div>
            )}
            
            {watching && !error && (
              <div className="text-center">
                {distance !== null ? (
                  <>
                    <div 
                      className="mx-auto mb-4 w-32 h-32 rounded-full bg-gray-100 relative border-4 border-gray-300 flex items-center justify-center"
                      style={{ boxShadow: "0 0 10px rgba(0,0,0,0.1)" }}
                    >
                      {/* Direction labels */}
                      <div className="absolute top-0 text-xs font-bold text-gray-600" style={{ transform: "translateY(-50%)" }}>N</div>
                      <div className="absolute right-0 text-xs font-bold text-gray-600" style={{ transform: "translateX(50%)" }}>E</div>
                      <div className="absolute bottom-0 text-xs font-bold text-gray-600" style={{ transform: "translateY(50%)" }}>S</div>
                      <div className="absolute left-0 text-xs font-bold text-gray-600" style={{ transform: "translateX(-50%)" }}>W</div>
                      
                      {/* Heading indicator arrow */}
                      {bearing !== null && (
                        <div 
                          className="absolute w-2 h-16 bg-green-500 rounded" 
                          style={{ 
                            transformOrigin: "bottom center",
                            transform: deviceOrientation !== null
                              ? `rotate(${bearing - deviceOrientation}deg) translateX(-50%)`
                              : `rotate(${bearing}deg) translateX(-50%)`,
                            bottom: "50%",
                            left: "50%"
                          }}
                        />
                      )}
                      
                      {/* Center dot */}
                      <div className="w-4 h-4 rounded-full bg-green-500 absolute" />
                      
                      {/* Current direction */}
                      {deviceOrientation !== null && (
                        <div className="absolute top-8 text-lg font-bold text-green-600">
                          {compassDirection}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-3xl font-bold mb-1">
                      {distance < 1000 
                        ? `${Math.round(distance)}m` 
                        : `${(distance / 1000).toFixed(1)}km`}
                    </div>
                    
                    <div className="text-sm text-gray-500 mb-4">
                      {distance <= 25 
                        ? "You've arrived!" 
                        : "Keep walking in the direction of the arrow"}
                    </div>
                    
                    {distance <= 25 && (
                      <button
                        onClick={unlockNext}
                        disabled={unlocking}
                        className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-6 rounded-lg disabled:opacity-50 w-full"
                      >
                        {unlocking ? "Unlocking..." : "Unlock This Location"}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="py-8 text-gray-500">
                    Getting your location...
                  </div>
                )}
              </div>
            )}
            
            {!watching && (
              <div className="text-center py-8 text-gray-500">
                Click "Start Compass" to begin navigating to the next location.
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Unlocked Locations</h2>
            {currentItem === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No locations unlocked yet. Start navigating to find your first song!
              </p>
            ) : (
              <ul className="space-y-3">
                {items.slice(0, currentItem).map((item, index) => (
                  <li key={index} className="flex items-center p-3 bg-green-50 rounded border border-green-200">
                    <span className="inline-block w-6 h-6 text-center bg-green-500 text-white rounded-full mr-2">
                      {index + 1}
                    </span>
                    <a 
                      href={item.spotifyUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-green-500 hover:underline"
                    >
                      {item.spotifyUrl.substring(0, 40)}...
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}