import { useLoaderData, useFetcher, Link, redirect } from "react-router"
import { useEffect, useState, useRef } from "react"
import type { Route } from "./+types/$sessionId"
import { getSessionWithUser, updateSessionProgress, associateSessionWithUser } from "../../lib/db"
import { calculateDistance, calculateBearing, getCompassDirection, getScheduleStatus } from "../../lib/utils"
import { getUser } from "../../lib/session"

export async function loader({ params, request }: Route.LoaderArgs) {
  const sessionId = params.sessionId as string
  const session = await getSessionWithUser(sessionId)

  if (!session) {
    throw new Response("Not Found", { status: 404 })
  }

  // Check if there's a logged in user
  const user = await getUser(request)

  return { session, user }
}

export async function action({ params, request }: Route.ActionArgs) {
  const session = await getSessionWithUser(params.sessionId as string)

  if (!session) {
    throw new Response("Not Found", { status: 404 })
  }

  const formData = await request.formData()
  const intent = formData.get("intent")

  if (intent === "update-progress") {
    const progress = Number(formData.get("progress"))

    if (isNaN(progress)) {
      return { error: "Invalid progress value", status: 400 }
    }

    // Only allow increasing progress (unlocking new songs)
    if (progress > session.progress) {
      await updateSessionProgress(session.id, progress)
    }
    
    return { success: true }
  } 
  else if (intent === "associate-session") {
    const user = await getUser(request)
    
    if (!user) {
      // If no user is logged in, redirect to login with return URL
      const params = new URLSearchParams()
      params.set("returnTo", `/play/${session.id}`)
      return redirect(`/auth/login?${params.toString()}`)
    }
    
    // Associate the session with the user
    const updatedSession = await associateSessionWithUser(session.id, user.id)
    return { success: true, session: updatedSession }
  }
  
  return { error: "Invalid intent", status: 400 }
}

export function meta({ data }: Route.MetaArgs) {
  if (!data?.session) {
    return [{ title: "Session Not Found - SpotiSpot" }]
  }

  const placelist = data.session.placelist
  const items = placelist.items as Array<{ 
    location: { lat: number; lng: number }; 
    spotifyUrl: string;
    onlyDuring?: string;
  }>
  const numStops = items.length

  return [
    { title: `Playing ${placelist.name} - SpotiSpot` },
    { name: "description", content: placelist.description || `A location-based music playlist with ${numStops} stops` },
    { property: "og:title", content: `${placelist.name} | SpotiSpot Adventure` },
    { property: "og:description", content: `Join this musical journey with ${numStops} locations to discover. Each spot unlocks a new track!` },
    { property: "og:type", content: "website" },
    { property: "twitter:card", content: "summary_large_image" },
    { property: "twitter:title", content: `${placelist.name} | SpotiSpot Adventure` },
    { property: "twitter:description", content: `Join this musical journey with ${numStops} locations to discover. Each spot unlocks a new track!` }
  ]
}

interface GeoPosition {
  coords: {
    latitude: number
    longitude: number
    accuracy: number
  }
}

export default function Player() {
  const { session, user } = useLoaderData<typeof loader>()
  const placelist = session.placelist
  const items = placelist.items as Array<{ 
    location: { lat: number; lng: number }; 
    spotifyUrl: string;
    onlyDuring?: string;
  }>
  
  // Check if session is already associated with a user
  const isSessionSaved = Boolean(session.userId)

  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentItem, setCurrentItem] = useState<number>(session.progress)
  const [distance, setDistance] = useState<number | null>(null)
  const [bearing, setBearing] = useState<number | null>(null)
  const [watching, setWatching] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [deviceOrientation, setDeviceOrientation] = useState<number | null>(null)
  const [compassDirection, setCompassDirection] = useState<string>("N")
  const [scheduleStatus, setScheduleStatus] = useState<{ 
    open: boolean; 
    nextOpenIn?: number | null;
    timeZone?: string;
  } | null>(null)

  const watchId = useRef<number | null>(null)
  const progressFetcher = useFetcher()
  const saveFetcher = useFetcher()

  // Complete state
  const isComplete = currentItem >= items.length

  // Request device orientation permission (for iOS)
  async function requestOrientationPermission() {
    // Check if DeviceOrientationEvent exists and has the requestPermission method (iOS 13+)
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        // Request permission
        const permissionState = await (DeviceOrientationEvent as any).requestPermission()
        if (permissionState === 'granted') {
          return true
        } else {
          console.warn("Device orientation permission denied")
          return false
        }
      } catch (error) {
        console.error("Error requesting device orientation permission:", error)
        return false
      }
    } else {
      // No permission needed for non-iOS or older iOS
      return true
    }
  }

  // Start watching geolocation and device orientation
  async function startWatching() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser")
      return
    }

    setWatching(true)

    // Start watching device orientation
    if (window.DeviceOrientationEvent) {
      // Request permission first (for iOS)
      const permissionGranted = await requestOrientationPermission()

      if (permissionGranted) {
        const handleOrientation = (event: DeviceOrientationEvent) => {
          // For iOS devices - alpha is relative to magnetic north
          if ((event as any).webkitCompassHeading !== undefined) {
            const heading = (event as any).webkitCompassHeading
            setDeviceOrientation(heading)
            setCompassDirection(getCompassDirection(heading))
          }
          // For Android devices - alpha is relative to arbitrary direction
          else if (event.alpha !== null) {
            const heading = 360 - event.alpha // Convert to clockwise rotation
            setDeviceOrientation(heading)
            setCompassDirection(getCompassDirection(heading))
          }
        }

        // Store reference to the handler for cleanup
        orientationHandlerRef.current = handleOrientation

        window.addEventListener('deviceorientation', handleOrientation, true)
      }
    } else {
      console.warn("Device orientation not supported by this browser")
    }

    // Start watching geolocation
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setPosition(position)
        setError(null)

        if (currentItem < items.length) {
          const target = items[currentItem].location
          const dist = calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            target.lat,
            target.lng
          )
          setDistance(dist)

          const bear = calculateBearing(
            position.coords.latitude,
            position.coords.longitude,
            target.lat,
            target.lng
          )
          setBearing(bear)

          // Always check schedule status for current item
          const currentItemData = items[currentItem];
          
          // Check if current location has schedule restrictions
          if (currentItemData.onlyDuring) {
            try {
              console.log("Found location with schedule:", currentItemData.onlyDuring);
              // Check the schedule status
              const status = getScheduleStatus(new Date(), currentItemData.onlyDuring);
              console.log("Schedule status:", status);
              setScheduleStatus(status);
              
              // Only auto-unlock if within 25 meters and the location is open
              if (dist <= 25 && !unlocking && status.open) {
                unlockNext();
              }
            } catch (err) {
              console.error("Error checking schedule:", err);
              // If there's an error with the schedule format, still allow unlocking
              setScheduleStatus(null);
              if (dist <= 25 && !unlocking) {
                unlockNext();
              }
            }
          } else {
            // No schedule restrictions, so clear any previous status
            setScheduleStatus(null);
            
            // Auto unlock if within 25 meters
            if (dist <= 25 && !unlocking) {
              unlockNext();
            }
          }
        }
      },
      (err) => {
        console.error(err)
        setError(`Error getting location: ${err.message}`)
        setWatching(false)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    )
  }

  // Reference to orientation event handler
  const orientationHandlerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null)

  // Stop watching geolocation and device orientation
  function stopWatching() {
    // Clear geolocation watch
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }

    // Remove device orientation event listener
    if (orientationHandlerRef.current) {
      window.removeEventListener('deviceorientation', orientationHandlerRef.current, true)
      orientationHandlerRef.current = null
    }

    setWatching(false)
  }

  // Unlock the next item when the user is at the right location
  function unlockNext() {
    if (currentItem < items.length && !unlocking) {
      setUnlocking(true)

      progressFetcher.submit(
        { 
          intent: "update-progress",
          progress: currentItem + 1 
        },
        { method: "post" }
      )

      // Optimistically update the UI
      setCurrentItem(currentItem + 1)

      // Reset state for next location if there is one
      if (currentItem + 1 < items.length) {
        setDistance(null)
        setBearing(null)
      }
    }
  }

  // Clean up the geolocation watcher and device orientation listener when the component unmounts
  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current)
      }

      if (orientationHandlerRef.current) {
        window.removeEventListener('deviceorientation', orientationHandlerRef.current, true)
      }
    }
  }, [])

  // Reset unlocking state when the progress fetcher is done
  useEffect(() => {
    if (progressFetcher.state === "idle" && unlocking) {
      setUnlocking(false)
    }
  }, [progressFetcher.state, unlocking])
  
  // Update schedule status every minute if we're at a location with schedule constraints
  useEffect(() => {
    if (!watching || !distance || distance > 25 || !items[currentItem]?.onlyDuring) {
      return; // No need to update if not at a scheduled location
    }
    
    // Update schedule status immediately
    const updateScheduleStatus = () => {
      if (items[currentItem]?.onlyDuring) {
        const status = getScheduleStatus(new Date(), items[currentItem].onlyDuring!);
        setScheduleStatus(status);
      }
    };
    
    // Set up interval to update every minute
    const intervalId = setInterval(updateScheduleStatus, 60000);
    
    // Run once immediately
    updateScheduleStatus();
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [watching, distance, currentItem, items])

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
        <h1 className="text-2xl font-bold">{placelist.name}</h1>
        
        {/* Save Progress Button */}
        <div className="mt-2 sm:mt-0">
          {isSessionSaved ? (
            <div className="flex items-center text-sm text-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {session.user ? (
                <span>Progress saved to <span className="font-medium">{session.user.name}</span></span>
              ) : (
                <span>Progress saved to your account</span>
              )}
            </div>
          ) : (
            <saveFetcher.Form method="post">
              <input type="hidden" name="intent" value="associate-session" />
              <button 
                type="submit"
                className="flex items-center text-sm bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded"
                disabled={saveFetcher.state !== "idle"}
              >
                {saveFetcher.state !== "idle" ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    {user ? "Save Progress" : "Sign In to Save Progress"}
                  </>
                )}
              </button>
            </saveFetcher.Form>
          )}
        </div>
      </div>
      
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
                <li key={index} className="p-3 bg-white rounded border border-gray-200">
                  <div className="flex items-center">
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
                  </div>
                  {item.onlyDuring && (
                    <div className="mt-2 text-xs text-gray-500 pl-8">
                      <span className="font-medium">Only available during:</span> {item.onlyDuring}
                    </div>
                  )}
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

                    {Boolean(items[currentItem]?.onlyDuring) && scheduleStatus ? (
                      <div className="mb-4">
                        {scheduleStatus.open ? (
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm mb-4">
                            <span className="inline-block w-4 h-4 rounded-full bg-green-500 mr-2"></span>
                            <span className="font-medium">Location is open now</span>
                            <div className="mt-1 text-green-700">
                              You can unlock this song!
                            </div>
                            <div className="mt-1 text-green-600">
                              Open hours: {items[currentItem].onlyDuring}
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm mb-4">
                            <span className="inline-block w-4 h-4 rounded-full bg-orange-500 mr-2"></span>
                            <span className="font-medium">This song can only be unlocked during open hours</span>
                            <div className="mt-2 text-orange-700">
                              <span className="font-medium">Open hours:</span> {items[currentItem].onlyDuring}
                            </div>
                            {scheduleStatus.nextOpenIn ? (
                              <div className="mt-2 text-orange-700">
                                You'll need to return in approximately {Math.ceil(scheduleStatus.nextOpenIn / 60)} hours to unlock this song
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ) : null}
                    
                    {distance <= 25 && (
                      <>
                        {Boolean(items[currentItem].onlyDuring) && scheduleStatus ? 
                          (scheduleStatus.open === false ? (
                            <div className="text-sm text-orange-700 mb-4 text-center font-medium">
                              You're at the right spot, but you need to come back during open hours!
                            </div>
                          ) : null) 
                        : null}
                        
                        <button
                          onClick={unlockNext}
                          disabled={unlocking || (Boolean(items[currentItem].onlyDuring) && scheduleStatus ? scheduleStatus.open === false : false)}
                          className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-6 rounded-lg disabled:opacity-50 w-full"
                        >
                          {unlocking ? "Unlocking..." : (
                            Boolean(items[currentItem].onlyDuring) && scheduleStatus ? 
                              (scheduleStatus.open === false ? "Location Closed - Song Locked" : "Unlock This Song") : 
                              "Unlock This Song"
                          )}
                        </button>
                      </>
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
                  <li key={index} className="p-3 bg-green-50 rounded border border-green-200">
                    <div className="flex items-center">
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
                    </div>
                    {item.onlyDuring && (
                      <div className="mt-2 text-xs text-gray-500 pl-8">
                        <span className="font-medium">Only available during:</span> {item.onlyDuring}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}