import { Link, useSearchParams } from "react-router";
import { requireUser } from "../../lib/session";
import type { Route } from "./+types/welcome";

export async function loader({ request }: Route.LoaderArgs) {
  // Make sure the user is authenticated
  await requireUser(request);
  return null;
}

export function meta() {
  return [
    { title: "Welcome to SpotiSpot" },
    { name: "description", content: "Your account has been created" },
  ];
}

export default function Welcome() {
  const [searchParams] = useSearchParams();
  const codename = searchParams.get("codename");
  const redirectTo = searchParams.get("redirectTo") || "/placelists";

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <h1 className="text-3xl font-bold mb-6 text-center">Welcome to SpotiSpot!</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            Your account has been created successfully.
          </p>
          
          <div className="bg-green-50 border border-green-200 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-2 text-green-700">Your Codename</h2>
            {codename ? (
              <p className="text-2xl font-bold mb-4 text-center py-3">
                {codename}
              </p>
            ) : (
              <p className="text-lg mb-4 text-center py-3 italic text-gray-500">
                (Your codename will be shown here)
              </p>
            )}
            <p className="text-sm text-green-700">
              <strong>Important:</strong> Please write down or remember your codename.
              This is how you'll log in to your account in the future.
            </p>
          </div>
        </div>
        
        <div className="flex justify-center">
          <Link 
            to={redirectTo}
            className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-6 rounded-lg"
          >
            Continue
          </Link>
        </div>
      </div>
    </div>
  );
}