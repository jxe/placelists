import { Link } from "react-router"
import { getPlacelistsByUser, getUserSessionsGrouped } from "../../lib/db"
import { requireUser } from "../../lib/session"
import { Form } from "react-router"
import type { Route } from './+types/index'

export async function loader({ request }: Route.LoaderArgs) {
  // Require user to be logged in
  const user = await requireUser(request)

  // Get placelists created by this user
  const placelists = await getPlacelistsByUser(user.id)
  
  // Get all user sessions grouped by status
  const { inProgressSessions, completedSessions } = await getUserSessionsGrouped(user.id)

  return {
    user,
    placelists,
    inProgressSessions,
    completedSessions
  }
}

export function meta() {
  return [
    { title: "My Placelists - SpotiSpot" },
    { name: "description", content: "View and manage your location-based music playlists" },
  ]
}

export default function PlacelistsIndex({ loaderData: { user, placelists, inProgressSessions, completedSessions } }: Route.ComponentProps) {
  const hasAnyContent = inProgressSessions.length > 0 || completedSessions.length > 0 || placelists.length > 0;

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

      {!hasAnyContent ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-xl mb-4">You don't have any placelists or active sessions yet</p>
          <p className="mb-6">Create your first placelist to get started!</p>
          <Link
            to="/placelists/new"
            className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg"
          >
            Create New Placelist
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {/* In Progress Sessions */}
          {inProgressSessions.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 border-b pb-2">In Progress</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {inProgressSessions.map((session) => {
                  const placelist = session.placelist;
                  const items = placelist.items as Array<{ location: { lat: number; lng: number }; spotifyUrl: string }>;
                  const progress = Math.round((session.progress / items.length) * 100);
                  
                  return (
                    <div
                      key={session.id}
                      className="p-6 bg-white border border-blue-100 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="text-xl font-bold mb-2">{placelist.name}</h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          In Progress
                        </span>
                      </div>
                      
                      {placelist.description && (
                        <p className="text-gray-700 mb-4 line-clamp-2">{placelist.description}</p>
                      )}
                      
                      <div className="mb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{session.progress} of {items.length} unlocked</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full" 
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                        <span>Last played: {new Date(session.updatedAt).toLocaleDateString()}</span>
                        {placelist.author && (
                          <span>By {placelist.author.id === user.id ? 'you' : placelist.author.name}</span>
                        )}
                      </div>
                      
                      <Link
                        to={`/play/${session.id}`}
                        className="inline-block w-full text-center bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
                      >
                        Continue Playing
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Completed Sessions */}
          {completedSessions.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 border-b pb-2">Completed</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {completedSessions.map((session) => {
                  const placelist = session.placelist;
                  const items = placelist.items as Array<{ location: { lat: number; lng: number }; spotifyUrl: string }>;
                  
                  return (
                    <div
                      key={session.id}
                      className="p-6 bg-white border border-green-100 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="text-xl font-bold mb-2">{placelist.name}</h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Completed
                        </span>
                      </div>
                      
                      {placelist.description && (
                        <p className="text-gray-700 mb-4 line-clamp-2">{placelist.description}</p>
                      )}
                      
                      <div className="mb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{items.length} of {items.length} unlocked</span>
                          <span>100%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div className="bg-green-600 h-2.5 rounded-full w-full"></div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                        <span>Completed: {new Date(session.updatedAt).toLocaleDateString()}</span>
                        {placelist.author && (
                          <span>By {placelist.author.id === user.id ? 'you' : placelist.author.name}</span>
                        )}
                      </div>
                      
                      <Link
                        to={`/play/${session.id}`}
                        className="inline-block w-full text-center bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded"
                      >
                        View
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Created Placelists */}
          {placelists.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 border-b pb-2">My Created Placelists</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {placelists.map((placelist) => {
                  const items = placelist.items as Array<{ location: { lat: number; lng: number }; spotifyUrl: string }>;
                  return (
                    <Link
                      key={placelist.id}
                      to={`/placelists/${placelist.id}`}
                      className="block p-6 bg-white border border-purple-100 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="text-xl font-bold mb-2">{placelist.name}</h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Created by You
                        </span>
                      </div>
                      
                      {placelist.description && (
                        <p className="text-gray-700 mb-4 line-clamp-2">{placelist.description}</p>
                      )}
                      
                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <span>{items.length} locations</span>
                        <span>Created {new Date(placelist.createdAt).toLocaleDateString()}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}