import { Link } from "react-router"
import { getPlacelistsByUser } from "../../lib/db"
import { requireUser } from "../../lib/session"
import { Form } from "react-router"
import type { Route } from './+types/index'

export async function loader({ request }: Route.LoaderArgs) {
  // Require user to be logged in
  const user = await requireUser(request)

  // Get placelists for this user
  const placelists = await getPlacelistsByUser(user.id)

  return {
    user,
    placelists
  }
}

export function meta() {
  return [
    { title: "My Placelists - SpotiSpot" },
    { name: "description", content: "View and manage your location-based music playlists" },
  ]
}

export default function PlacelistsIndex({ loaderData: { user, placelists } }: Route.ComponentProps) {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">My Placelists</h1>
        <Link
          to="/placelists/new"
          className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg"
        >
          Create New
        </Link>
      </div>

      <div className="bg-gray-50 p-4 mb-8 rounded-lg flex justify-between items-center">
        <div>
          <p className="text-gray-600">Signed in as <span className="font-semibold">{user.name}</span></p>
          <p className="text-sm text-gray-500">Remember your codename to sign in next time!</p>
        </div>
        <Form action="/auth/logout" method="post">
          <button
            type="submit"
            className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-1 px-3 rounded"
          >
            Sign Out
          </button>
        </Form>
      </div>

      {placelists.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-xl mb-4">You haven't created any placelists yet</p>
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
            const items = placelist.items as Array<{ location: { lat: number; lng: number }; spotifyUrl: string }>
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
            )
          })}
        </div>
      )}
    </div>
  )
}