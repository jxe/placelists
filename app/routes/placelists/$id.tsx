import { Link, redirect, useLoaderData, Form } from "react-router";
import { useState, useEffect } from "react";
import type { Route } from "./+types/$id";
import { getPlacelist, createSession, deletePlacelist } from "../../lib/db";
import { extractSpotifyTrackId, getGoogleStaticMapUrl } from "../../lib/utils";
import { getSpotifyTrackInfo, type SpotifyTrackInfo } from "../../lib/spotify";
import { getUser, requireUser } from "../../lib/session";

interface EnhancedPlacelistItem {
  location: {
    lat: number;
    lng: number;
  };
  spotifyUrl: string;
  trackId: string | null;
  trackInfo?: SpotifyTrackInfo | null;
}

export async function loader({ params, request }: Route.LoaderArgs) {
  // Get the logged-in user
  const user = await requireUser(request);
  
  const placelist = await getPlacelist(params.id as string);
  
  if (!placelist) {
    throw new Response("Not Found", { status: 404 });
  }
  
  // Check if the user is the author
  if (placelist.authorId !== user.id) {
    throw new Response("Unauthorized: You can only view your own placelists", { status: 403 });
  }
  
  // Enhance items with Spotify track IDs
  const items = placelist.items as Array<{ location: { lat: number; lng: number }; spotifyUrl: string }>;
  const enhancedItems: EnhancedPlacelistItem[] = [];
  
  for (const item of items) {
    const trackId = extractSpotifyTrackId(item.spotifyUrl);
    let trackInfo = null;
    
    if (trackId) {
      // Try to fetch track info - this will only work if env variables are set
      trackInfo = await getSpotifyTrackInfo(item.spotifyUrl);
    }
    
    enhancedItems.push({
      ...item,
      trackId,
      trackInfo
    });
  }
  
  return { placelist, enhancedItems, user };
}

export async function action({ params, request }: Route.ActionArgs) {
  // Get the logged-in user
  const user = await requireUser(request);
  
  const placelist = await getPlacelist(params.id as string);
  
  if (!placelist) {
    throw new Response("Not Found", { status: 404 });
  }
  
  // Check if the user is the author
  if (placelist.authorId !== user.id) {
    throw new Response("Unauthorized: You can only modify your own placelists", { status: 403 });
  }
  
  const formData = await request.formData();
  const intent = formData.get("intent");
  
  if (intent === "delete") {
    await deletePlacelist(placelist.id);
    return redirect("/placelists");
  }
  
  if (intent === "createSession") {
    const session = await createSession(placelist.id);
    return redirect(`/play/${session.id}`);
  }
  
  return null;
}

export function meta({ data }: Route.MetaArgs) {
  if (!data?.placelist) {
    return [{ title: "Placelist Not Found - SpotiSpot" }];
  }
  
  return [
    { title: `${data.placelist.name} - SpotiSpot` },
    { name: "description", content: data.placelist.description || `A location-based music playlist` },
  ];
}

export default function PlacelistDetail() {
  const { placelist, enhancedItems } = useLoaderData<typeof loader>();
  
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <Link to="/placelists" className="text-green-500 hover:underline mb-4 inline-block">
          ← Back to all placelists
        </Link>
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold">{placelist.name}</h1>
            {placelist.description && (
              <p className="text-gray-700 mt-2">{placelist.description}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Link
              to={`/placelists/${placelist.id}/edit`}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg"
            >
              Edit
            </Link>
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <button
                type="submit"
                className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg"
                onClick={e => {
                  if (!confirm("Are you sure you want to delete this placelist?")) {
                    e.preventDefault();
                  }
                }}
              >
                Delete
              </button>
            </Form>
          </div>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Locations ({enhancedItems.length})</h2>
        <div className="bg-gray-50 p-6 rounded-lg">
          <ul className="space-y-6">
            {enhancedItems.map((item, index) => (
              <li key={index} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Location Map */}
                  <div className="h-48 md:h-auto">
                    <img 
                      src={getGoogleStaticMapUrl(item.location.lat, item.location.lng, 14, 400, 300)} 
                      alt={`Map location ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Location Details */}
                  <div className="p-4 md:col-span-2">
                    <div className="flex items-center mb-3">
                      <span className="inline-block w-6 h-6 text-center bg-green-500 text-white rounded-full mr-2">
                        {index + 1}
                      </span>
                      {item.trackInfo ? (
                        <span className="font-medium">{item.trackInfo.name} - {item.trackInfo.artist}</span>
                      ) : (
                        <span className="font-medium">Location {index + 1}</span>
                      )}
                    </div>
                    
                    <div className="mb-4">
                      <div className="font-mono text-sm mb-2">
                        {item.location.lat.toFixed(6)}, {item.location.lng.toFixed(6)}
                      </div>
                    </div>
                    
                    {/* Spotify Embed */}
                    {item.trackId ? (
                      <div className="spotify-embed">
                        <div 
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
                      </div>
                    ) : (
                      <a
                        href={item.spotifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-500 hover:underline inline-block"
                      >
                        {item.spotifyUrl}
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="bg-green-50 p-6 rounded-lg border border-green-200">
        <h2 className="text-xl font-semibold mb-2">Share this Placelist</h2>
        <p className="mb-4">
          Create a unique player link to share with someone. They will be guided to each location
          to unlock the songs.
        </p>
        <Form method="post">
          <input type="hidden" name="intent" value="createSession" />
          <button
            type="submit"
            className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg"
          >
            Create Player Link
          </button>
        </Form>
      </div>
    </div>
  );
}