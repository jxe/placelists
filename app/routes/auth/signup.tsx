import {
  Form,
  Link,
  useNavigation,
  useSearchParams
} from "react-router"
import { createUser } from "../../lib/db"
import { createUserSession } from "../../lib/session"
import type { Route } from "./+types/signup"

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const redirectTo = formData.get("redirectTo") as string || "/placelists"

  try {
    // Create a new user with a random codename
    const user = await createUser()
    
    // Store the user's codename to display it
    // This is stored in the return value in case of errors
    // It will be available in the success message otherwise
    const result = {
      user,
      codename: user.codename,
      redirectTo
    }
    
    // Create session and redirect with the codename - use URLSearchParams to pass it
    const params = new URLSearchParams();
    params.set("codename", user.codename);
    params.set("redirectTo", redirectTo);
    
    return await createUserSession(
      user.id, 
      `/auth/welcome?${params.toString()}`
    )
  } catch (error) {
    console.error("Error creating user:", error)
    return { error: "An error occurred during signup." }
  }
}

export function meta() {
  return [
    { title: "Sign Up - SpotiSpot" },
    { name: "description", content: "Create a new account on SpotiSpot" },
  ]
}

export default function Signup({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get("redirectTo") || "/placelists"
  const isSubmitting = navigation.state === "submitting"

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <h1 className="text-3xl font-bold mb-6 text-center">Create an Account</h1>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="mb-4 text-gray-700">
          Create a new account to start making your own placelists.
          You'll receive a unique codename that you'll use to log in.
        </p>
        
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg mb-6">
          <p className="text-sm font-medium mb-1">Important:</p>
          <p className="text-sm">
            Your codename will look like "Fluffy Ornate Bunny" and will be shown after sign-up.
            <strong> Make sure to remember it</strong> as it's the only way to access your account!
          </p>
        </div>

        <Form method="post">
          <input type="hidden" name="redirectTo" value={redirectTo} />

          {actionData?.error && (
            <p className="text-red-500 text-sm mb-4">{actionData.error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? "Creating Account..." : "Create Account"}
          </button>
        </Form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{" "}
            <Link
              to={`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`}
              className="text-green-600 hover:underline font-medium"
            >
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}