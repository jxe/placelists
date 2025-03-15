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
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

// Calculate bearing between two coordinates
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const θ = Math.atan2(y, x)

  return ((θ * 180) / Math.PI + 360) % 360 // in degrees
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
  ]

  // Handle special case for North spanning 348.75-360 and 0-11.25
  if (degrees >= 348.75 || degrees < 11.25) {
    return "N"
  }

  // Find the matching direction
  for (const dir of directions) {
    if (degrees >= dir.min && degrees < dir.max) {
      return dir.label
    }
  }

  return "N" // Default fallback
}

/**
 * Extracts Spotify track ID from a Spotify URL
 */
export function extractSpotifyTrackId(spotifyUrl: string): string | null {
  // Handle both formats: https://open.spotify.com/track/ID and spotify:track:ID
  if (spotifyUrl.includes('spotify.com/track/')) {
    const match = spotifyUrl.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/)
    return match ? match[1] : null
  } else if (spotifyUrl.includes('spotify:track:')) {
    const match = spotifyUrl.match(/spotify:track:([a-zA-Z0-9]+)/)
    return match ? match[1] : null
  }
  return null
}

/**
 * Generates a Google Static Maps URL for a given location
 */
export function getGoogleStaticMapUrl(lat: number, lng: number, zoom: number = 14, width: number = 600, height: number = 300): string {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (apiKey) {
    // If API key is available, use the Google Maps API
    // Added scale=2 for higher resolution images
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&scale=2&markers=color:red%7C${lat},${lng}&key=${apiKey}`
  } else {
    // Fallback to placeholder if no API key is provided
    return `https://placehold.co/${width}x${height}?text=Map+Location:+${lat.toFixed(4)},${lng.toFixed(4)}`
  }
}


type DayAbbreviation = "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su"

interface TimeRange {
  start: number // Minutes since midnight
  end: number   // Minutes since midnight (next day allowed)
  days: Set<DayAbbreviation>
}

interface ScheduleParseResult {
  timeRanges: TimeRange[]
  timeZone: string // Named time zone
}

/**
 * Expands day ranges (e.g., "MO-WE" → ["MO", "TU", "WE"])
 */
function expandDayRange(dayRange: string): DayAbbreviation[] {
  const dayOrder: DayAbbreviation[] = ["mo", "tu", "we", "th", "fr", "sa", "su"]
  const expandedDays: DayAbbreviation[] = []

  dayRange.split(", ").forEach(part => {
    // Convert to lowercase for case-insensitive comparison
    const normalizedPart = part.toLowerCase();
    
    const rangeMatch = normalizedPart.match(/^([a-z]{2})-([a-z]{2})$/i)
    if (rangeMatch) {
      const [, startDay, endDay] = rangeMatch
      const startIndex = dayOrder.indexOf(startDay.toLowerCase() as DayAbbreviation)
      const endIndex = dayOrder.indexOf(endDay.toLowerCase() as DayAbbreviation)
      if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
        expandedDays.push(...dayOrder.slice(startIndex, endIndex + 1))
      }
    } else if (dayOrder.includes(normalizedPart as DayAbbreviation)) {
      expandedDays.push(normalizedPart as DayAbbreviation)
    }
  })

  return expandedDays
}

/**
 * Converts AM/PM or hour-only time to minutes since midnight.
 */
function parseTime(time: string): number {
  const match = time.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m?)?$/i)
  if (!match) throw new Error(`Invalid time format: ${time}`)

  let [_, hourStr, minuteStr, period] = match
  let hour = parseInt(hourStr, 10)
  let minutes = minuteStr ? parseInt(minuteStr, 10) : 0

  if (period) {
    period = period.toUpperCase()
    if (period.startsWith("p") && hour !== 12) hour += 12
    if (period.startsWith("a") && hour === 12) hour = 0
  }

  return hour * 60 + minutes
}

/**
 * Parses a schedule string and extracts a named time zone if present.
 */
function parseSchedule(schedule: string): ScheduleParseResult {
  try {
    console.log("Parsing schedule:", schedule);
    
    // Extract time zone if present
    const tzMatch = schedule.match(/\s([A-Z]{2,5})$/i)
    const timeZone = tzMatch ? tzMatch[1] : Intl.DateTimeFormat().resolvedOptions().timeZone // Default to local time zone
    console.log("Timezone identified:", timeZone);

    // Remove timezone for parsing
    const scheduleWithoutTZ = schedule.replace(/\s[A-Z]{2,5}$/, "")
    console.log("Schedule without timezone:", scheduleWithoutTZ);

    const timeRanges = scheduleWithoutTZ.split("; ").flatMap(entry => {
      console.log("Processing entry:", entry);
      
      // Extract time ranges and days
      const match = entry.match(/([\d:apm,-\s]+) \(([^)]+)\)/i)
      if (!match) {
        console.error(`Invalid format - couldn't match pattern in: ${entry}`);
        throw new Error(`Invalid format: ${entry}`);
      }

      const [_, timePart, daysPart] = match
      console.log("Time part:", timePart, "Days part:", daysPart);
      
      // Get day set
      const days = new Set(expandDayRange(daysPart))
      console.log("Expanded days:", [...days]);

      return timePart.split(", ").map(timeRange => {
        console.log("Processing time range:", timeRange);
        
        // Split into start and end times
        const times = timeRange.split("-");
        if (times.length !== 2) {
          console.error(`Invalid time range format - expected two times separated by '-': ${timeRange}`);
          throw new Error(`Invalid time range format: ${timeRange}`);
        }
        
        try {
          const start = parseTime(times[0].trim());
          const end = parseTime(times[1].trim());
          console.log(`Parsed times: ${start}mins to ${end}mins`);
          
          return {
            start,
            end: end < start ? end + 1440 : end, // Handle overnight shifts
            days,
          };
        } catch (err) {
          console.error(`Error parsing time range: ${timeRange}`, err);
          throw err;
        }
      });
    });

    console.log("Parsed time ranges:", timeRanges);
    return { timeRanges, timeZone };
  } catch (err) {
    console.error("Failed to parse schedule:", err);
    // Return an empty time range with local timezone in case of error
    return { 
      timeRanges: [],
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }
}

/**
 * Converts a Date object to a specific time zone and returns the time in minutes since midnight.
 */
function getMinutesSinceMidnightInTimeZone(date: Date, timeZone: string): number {
  const options = { timeZone, hour12: false, hour: "2-digit", minute: "2-digit" } as const
  const formatted = new Intl.DateTimeFormat("en-US", options).format(date)
  const [hour, minute] = formatted.split(":").map(Number)
  return hour * 60 + minute
}

/**
 * Determines if the current time is within any scheduled ranges and provides extra info.
 */
export function getScheduleStatus(date: Date, schedule: string) {
  const { timeRanges, timeZone } = parseSchedule(schedule)

  // Convert the current time to the specified time zone
  const targetMinutesSinceMidnight = getMinutesSinceMidnightInTimeZone(date, timeZone)
  // Use lowercase day abbreviations to match our set (DayAbbreviation)
  const dayAbbr: DayAbbreviation = ["su", "mo", "tu", "we", "th", "fr", "sa"][date.getDay()] as DayAbbreviation
  // For previous day (to handle overnight shifts)
  const prevDayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
  const prevDayAbbr: DayAbbreviation = ["su", "mo", "tu", "we", "th", "fr", "sa"][prevDayIndex] as DayAbbreviation

  let nextOpening: number | null = null

  for (const { start, end, days } of timeRanges) {
    if (days.has(dayAbbr) && targetMinutesSinceMidnight >= start && targetMinutesSinceMidnight < end) {
      return { open: true, earlyBy: null, nextOpenIn: null, timeZone }
    }

    // Handle overnight shifts: If time is past midnight but was still part of a previous day's range
    if (days.has(prevDayAbbr) && targetMinutesSinceMidnight < end - 1440) {
      return { open: true, earlyBy: null, nextOpenIn: null, timeZone }
    }

    if (days.has(dayAbbr) && targetMinutesSinceMidnight < start) {
      nextOpening = nextOpening === null ? start : Math.min(nextOpening, start)
    }
  }

  if (nextOpening !== null) {
    return {
      open: false,
      nextOpenIn: nextOpening - targetMinutesSinceMidnight,
      timeZone,
    }
  }

  return { open: false, nextOpenIn: null, timeZone }
}
