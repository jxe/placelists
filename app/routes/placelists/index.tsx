import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/index";
import { getAllPlacelists } from "../../lib/db";

export async function loader() {
  const placelists = await getAllPlacelists();
  return { placelists };
}

export function meta() {
  return [
    { title: "All Placelists - SpotiSpot" },
    { name: "description", content: "Browse all location-based music playlists" },
  ];
}

export default function PlacelistsIndex() {
  const { placelists } = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Placelists</h1>
        <Link
          to="/placelists/new"
          className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg"
        >
          Create New
        </Link>
      </div>

      {placelists.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-xl mb-4">No placelists found</p>
          <p className="mb-6">Create your first placelist to get started!</p>
          <Link
            to="/placelists/new"
            className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg"
          >
            Create New Placelist
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {placelists.map((placelist) => {
            const items = placelist.items as Array<{ location: { lat: number; lng: number }; spotifyUrl: string }>;
            return (
              <Link
                key={placelist.id}
                to={`/placelists/${placelist.id}`}
                className="block p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <h2 className="text-xl font-bold mb-2">{placelist.name}</h2>
                {placelist.description && (
                  <p className="text-gray-700 mb-4">{placelist.description}</p>
                )}
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>{items.length} locations</span>
                  <span>Created {new Date(placelist.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}