import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import { getUser } from "../lib/session";

export async function loader({ request }: Route.LoaderArgs) {
  // Check if user is logged in
  const user = await getUser(request);
  return { user };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "SpotiSpot - Location-based Music Playlists" },
    { name: "description", content: "Create and share music playlists tied to specific locations" },
  ];
}

export default function Home() {
  const { user } = useLoaderData<typeof loader>();
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-extrabold mb-4">SpotiSpot</h1>
        <p className="text-xl mb-8">
          Create location-based playlists to share with friends. 
          Guide them on a musical journey through physical spaces.
        </p>
        <div className="flex gap-4 justify-center mt-8">
          {user ? (
            // User is logged in - show links to placelists
            <>
              <Link 
                to="/placelists" 
                className="bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-lg"
              >
                My Placelists
              </Link>
              <Link 
                to="/placelists/new" 
                className="bg-white hover:bg-gray-100 text-green-500 border border-green-500 font-medium py-3 px-6 rounded-lg"
              >
                Create New Placelist
              </Link>
            </>
          ) : (
            // User is not logged in - show sign in options
            <>
              <Link 
                to="/auth/login" 
                className="bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-lg"
              >
                Sign In
              </Link>
              <Link 
                to="/auth/signup" 
                className="bg-white hover:bg-gray-100 text-green-500 border border-green-500 font-medium py-3 px-6 rounded-lg"
              >
                Create Account
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-center md:text-left">
        <div>
          <h2 className="text-2xl font-bold mb-4">How It Works</h2>
          <ol className="list-decimal list-inside space-y-3">
            <li>Create a placelist with GPS coordinates and Spotify links</li>
            <li>Share the unique player URL with a friend</li>
            <li>They follow the compass to each location</li>
            <li>When they arrive, they unlock the song for that spot</li>
          </ol>
        </div>
        
        <div>
          <h2 className="text-2xl font-bold mb-4">Perfect For</h2>
          <ul className="list-disc list-inside space-y-3">
            <li>Birthday scavenger hunts</li>
            <li>Neighborhood audio tours</li>
            <li>City explorations with friends</li>
            <li>Memory lane walks with meaningful songs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
