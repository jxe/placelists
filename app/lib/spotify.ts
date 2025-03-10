import { extractSpotifyTrackId } from './utils';

/**
 * Interface for Spotify track information
 */
export interface SpotifyTrackInfo {
  name: string;
  artist: string;
  albumImage: string;
  previewUrl: string | null;
}

/**
 * Get Spotify access token using client credentials flow
 */
async function getSpotifyAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.warn('Spotify API credentials not found in environment variables');
    return null;
  }
  
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });
    
    if (!response.ok) {
      console.error('Failed to get Spotify access token:', await response.text());
      return null;
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting Spotify access token:', error);
    return null;
  }
}

/**
 * Fetch track information from Spotify API
 */
export async function getSpotifyTrackInfo(spotifyUrl: string): Promise<SpotifyTrackInfo | null> {
  const trackId = extractSpotifyTrackId(spotifyUrl);
  
  if (!trackId) {
    return null;
  }
  
  try {
    // Get access token using client credentials
    const accessToken = await getSpotifyAccessToken();
    
    if (!accessToken) {
      return null;
    }
    
    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch track info:', await response.text());
      return null;
    }
    
    const data = await response.json();
    
    return {
      name: data.name,
      artist: data.artists[0].name,
      albumImage: data.album.images[1]?.url || '', // Medium size image
      previewUrl: data.preview_url
    };
  } catch (error) {
    console.error('Error fetching Spotify track:', error);
    return null;
  }
}

/**
 * Get Spotify embed iframe HTML for a track
 */
export function getSpotifyEmbedHtml(trackId: string): string {
  return `<iframe 
    style="border-radius:12px" 
    src="https://open.spotify.com/embed/track/${trackId}" 
    width="100%" 
    height="80" 
    frameBorder="0" 
    allowfullscreen="" 
    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
    loading="lazy">
  </iframe>`;
}