import { Link, redirect, useLoaderData, Form } from "react-router";
import type { Route } from "./+types/$id";
import { getPlacelist, createSession, deletePlacelist } from "../../lib/db";

export async function loader({ params }: Route.LoaderArgs) {
  const placelist = await getPlacelist(params.id as string);
  
  if (!placelist) {
    throw new Response("Not Found", { status: 404 });
  }
  
  return { placelist };
}

export async function action({ params, request }: Route.ActionArgs) {
  const placelist = await getPlacelist(params.id as string);
  
  if (!placelist) {
    throw new Response("Not Found", { status: 404 });
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
  const { placelist } = useLoaderData<typeof loader>();
  const items = placelist.items as Array<{ location: { lat: number; lng: number }; spotifyUrl: string }>;
  
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
        <h2 className="text-xl font-semibold mb-4">Locations ({items.length})</h2>
        <div className="bg-gray-50 p-6 rounded-lg">
          <ul className="space-y-4">
            {items.map((item, index) => (
              <li key={index} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                <div>
                  <span className="inline-block w-6 h-6 text-center bg-green-500 text-white rounded-full mr-2">
                    {index + 1}
                  </span>
                  <span className="font-mono text-sm">
                    {item.location.lat.toFixed(6)}, {item.location.lng.toFixed(6)}
                  </span>
                </div>
                <a
                  href={item.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-500 hover:underline mt-2 md:mt-0"
                >
                  {item.spotifyUrl.substring(0, 60)}...
                </a>
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