import {
  Form,
  Link,
  useNavigation,
  useSearchParams,
  useLoaderData
} from "react-router"
import { getUserByCodename, adjectives1, adjectives2, nouns } from "../../lib/db"
import { createUserSession } from "../../lib/session"
import type { Route } from "./+types/login"

export async function loader() {
  // Return the lists of adjectives and nouns for the dropdowns
  return {
    adjectives1,
    adjectives2,
    nouns
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const adj1 = formData.get("adjective1") as string
  const adj2 = formData.get("adjective2") as string
  const noun = formData.get("noun") as string
  const redirectTo = formData.get("redirectTo") as string || "/placelists"

  if (!adj1 || !adj2 || !noun) {
    return { error: "Please select all three parts of your codename" }
  }

  const user = await getUserByCodename(adj1, adj2, noun)

  if (!user) {
    return { error: "Invalid codename. Please try again or create a new account." }
  }

  // Create user session and redirect
  return await createUserSession(user.id, redirectTo)
}

export function meta() {
  return [
    { title: "Log In - SpotiSpot" },
    { name: "description", content: "Log in to SpotiSpot to access your placelists" },
  ]
}

export default function Login({ actionData }: Route.ComponentProps) {
  const { adjectives1, adjectives2, nouns } = useLoaderData<typeof loader>();
  const navigation = useNavigation()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get("redirectTo") || searchParams.get("returnTo") || "/placelists"
  const isSubmitting = navigation.state === "submitting"

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <h1 className="text-3xl font-bold mb-6 text-center">Log In to SpotiSpot</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="mb-6 text-gray-700">
          Select your three-part codename to access your placelists
        </p>

        <Form method="post">
          <input type="hidden" name="redirectTo" value={redirectTo} />

          <div className="space-y-4 mb-6">
            <div>
              <label htmlFor="adjective1" className="block text-sm font-medium mb-2">
                First Adjective
              </label>
              <select
                id="adjective1"
                name="adjective1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                required
              >
                <option value="">Select first adjective...</option>
                {adjectives1.map((adj) => (
                  <option key={adj} value={adj}>
                    {adj.charAt(0).toUpperCase() + adj.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="adjective2" className="block text-sm font-medium mb-2">
                Second Adjective
              </label>
              <select
                id="adjective2"
                name="adjective2"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                required
              >
                <option value="">Select second adjective...</option>
                {adjectives2.map((adj) => (
                  <option key={adj} value={adj}>
                    {adj.charAt(0).toUpperCase() + adj.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="noun" className="block text-sm font-medium mb-2">
                Animal
              </label>
              <select
                id="noun"
                name="noun"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                required
              >
                <option value="">Select animal...</option>
                {nouns.map((noun) => (
                  <option key={noun} value={noun}>
                    {noun.charAt(0).toUpperCase() + noun.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {actionData?.error && (
            <p className="text-red-500 text-sm mb-4">{actionData.error}</p>
          )}

          <div className="example-codename text-center mb-6 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">Your codename will look like:</p>
            <p className="font-medium">Fluffy Ornate Bunny</p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? "Logging in..." : "Log In"}
          </button>
        </Form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Don't have an account?{" "}
            <Link
              to={`/auth/signup?redirectTo=${encodeURIComponent(redirectTo)}`}
              className="text-green-600 hover:underline font-medium"
            >
              Create One
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}