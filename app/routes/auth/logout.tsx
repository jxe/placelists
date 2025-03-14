import { redirect } from "react-router"
import { logout } from "../../lib/session"
import type { Route } from "./+types/logout"

export async function action({ request }: Route.ActionArgs) {
  return logout(request)
}

export function loader() {
  return redirect("/auth/login")
}

export default function Logout() {
  return <p>Logging out...</p>
}